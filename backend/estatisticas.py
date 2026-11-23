"""Números do painel admin > Estatísticas e das pendências do admin.

Regras gerais:
- Só contas ativas entram (inclusive as visitas: só contam as de quem hoje tem conta ativa).
- Datas no horário de Brasília.
- Distribuições por grupo (órgão, tema, turma, formação) nunca mostram grupo com menos de
  MINIMO_GRUPO pessoas: esses se juntam em "Outros", para que um número agregado (print, CSV)
  não identifique ninguém. O detalhe fica na lista de usuários, que já é nominal.
"""
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from documentos_legais import OBRIGATORIOS, documento_atual
from lotacao_auto import normalizar
from models import (
    Acesso, Analista, BaseAtps, ConflitoCadastro, EnvioEmail, EventoPerfil, Favorito,
    NivelFormacao, Tema, UnidadeSiorg,
)

MINIMO_GRUPO = 3
TOP = 10
OUTROS = "Outros"
SEM_ORGAO = "Não identificado"
FUSO = timedelta(hours=-3)

NIVEIS = [  # do mais alto ao mais baixo
    (NivelFormacao.pos_doutorado, "Pós-doutorado"),
    (NivelFormacao.doutorado, "Doutorado"),
    (NivelFormacao.mestrado, "Mestrado"),
    (NivelFormacao.especializacao, "Especialização"),
    (NivelFormacao.graduacao, "Graduação"),
]
TURMAS = {"turma_2012": "2012", "turma_2016": "2016", "turma_2024_cpnu": "2024 (CPNU)"}

# Itens do perfil acompanhados na completude: chave -> rótulo. A chave é a mesma do filtro
# ?sem= da lista de usuários (routers/admin.py), para o clique no gráfico abrir quem não tem.
ITENS_PERFIL = {
    "foto": "Foto",
    "tema": "Ao menos um tema",
    "formacao": "Formação",
    "pode_ajudar": "“Em que posso ajudar”",
    "links": "LinkedIn ou Lattes",
    "lotacao": "Lotação ligada ao SIORG",
    "contato": "E-mail ou telefone institucional",
}


def hoje_brasilia() -> date:
    return (datetime.now(timezone.utc) + FUSO).date()


def dia_brasilia(d: datetime) -> date:
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return (d + FUSO).date()


def _preenchido(texto: str | None) -> bool:
    return bool(texto and texto.strip())


def tem_item(a: Analista, item: str) -> bool:
    if item == "foto":
        return a.foto_path is not None
    if item == "tema":
        return bool(a.temas)
    if item == "formacao":
        return bool(a.formacoes)
    if item == "pode_ajudar":
        return _preenchido(a.pode_ajudar)
    if item == "links":
        return _preenchido(a.linkedin_url) or _preenchido(a.lattes_url)
    if item == "lotacao":
        return a.lotacao_siorg_id is not None
    if item == "contato":
        return _preenchido(a.email_institucional) or _preenchido(a.telefone_institucional)
    raise ValueError(item)


def perfil_minimo(a: Analista) -> bool:
    """O mínimo para alguém ser encontrado: ao menos um tema e o órgão preenchido."""
    return bool(a.temas) and (a.lotacao_siorg_id is not None or _preenchido(a.ministerio))


def sem_pendencias(a: Analista) -> bool:
    """CPF guardado e termos atuais aceitos (o que a Rede exige antes de liberar o uso)."""
    if a.cpf_cifrado is None:
        return False
    return all(a.versao_aceita(t) == documento_atual(t).versao for t in OBRIGATORIOS)


def nivel_mais_alto(a: Analista) -> str | None:
    niveis = {f.nivel for f in a.formacoes}
    return next((rotulo for nivel, rotulo in NIVEIS if nivel in niveis), None)


# --- órgão: mesma resolução da página de cobertura ---

class ResolvedorOrgao:
    """Órgão (SIORG, profundidade 0) de cada perfil: pela lotação ligada ao SIORG ou, sem ela,
    pelo nome do ministério digitado."""

    def __init__(self, db: Session):
        self.orgaos = {o.id: o for o in db.scalars(select(UnidadeSiorg).where(UnidadeSiorg.profundidade == 0))}
        self._por_nome = {normalizar(o.nome): o.id for o in self.orgaos.values()}
        self._da_unidade = dict(db.execute(select(UnidadeSiorg.id, UnidadeSiorg.orgao_id)).all())

    def orgao_id(self, a: Analista) -> int | None:
        orgao_id = self._da_unidade.get(a.lotacao_siorg_id) if a.lotacao_siorg_id else None
        if orgao_id is None and a.ministerio:
            orgao_id = self._por_nome.get(normalizar(a.ministerio))
        return orgao_id if orgao_id in self.orgaos else None

    def rotulo(self, orgao_id: int) -> str:
        o = self.orgaos[orgao_id]
        return o.sigla or o.nome


def agrupar(contagem: list[tuple[str, int, str | None]], top: int | None = TOP, ordenar: bool = True) -> list[dict]:
    """(rótulo, total, filtro) -> lista para gráfico. Grupos com menos de MINIMO_GRUPO pessoas e os
    que passam do top viram "Outros" (sem filtro: não dá para abrir a lista de um grupo misturado)."""
    itens = sorted(contagem, key=lambda x: (-x[1], x[0])) if ordenar else list(contagem)
    saida, outros = [], 0
    for rotulo, total, filtro in itens:
        if total <= 0:
            continue
        if total < MINIMO_GRUPO or (top is not None and len(saida) >= top):
            outros += total
        else:
            saida.append({"rotulo": rotulo, "total": total, "filtro": filtro})
    if outros:
        saida.append({"rotulo": OUTROS, "total": outros, "filtro": None})
    return saida


# --- pendências do admin ---

def pendencias(db: Session) -> dict:
    agora = datetime.now(timezone.utc)
    motivos = Counter(
        (m or "Sem motivo registrado") for (m,) in
        db.query(Analista.motivo_pendencia).filter(Analista.pendente_revisao.is_(True))
    )
    vinculo = db.query(func.count(Analista.id)).filter(
        (Analista.vinculo_suspenso_em.isnot(None))
        | (Analista.ativo.is_(True) & Analista.motivo_pendencia.isnot(None))
    ).scalar() or 0
    return {
        "revisao": sum(motivos.values()),
        "revisao_motivos": [{"motivo": m, "total": n} for m, n in motivos.most_common()],
        "vinculo": vinculo,
        "conflitos": db.query(func.count(ConflitoCadastro.id)).filter(ConflitoCadastro.resolvido.is_(False)).scalar() or 0,
        "temas": db.query(func.count(Tema.id)).filter(Tema.revisado.is_(False), Tema.reprovado.is_(False)).scalar() or 0,
        "bloqueadas": db.query(func.count(Analista.id)).filter(Analista.login_bloqueado_ate > agora).scalar() or 0,
    }


# --- estatísticas ---

def _serie(inicio: date, fim: date) -> list[date]:
    return [inicio + timedelta(days=i) for i in range((fim - inicio).days + 1)]


def estatisticas(db: Session, dias: int) -> dict:
    """dias: tamanho do período (7, 30, 90) ou 0 para desde o início."""
    hoje = hoje_brasilia()
    ativos = (
        db.query(Analista).filter(Analista.ativo.is_(True))
        .options(selectinload(Analista.temas), selectinload(Analista.formacoes), selectinload(Analista.consentimentos))
        .all()
    )
    ids = {a.id for a in ativos}
    criacao = {a.id: dia_brasilia(a.criado_em) for a in ativos}

    # visitas de quem tem conta ativa: dias distintos e total por pessoa
    visitas = [(d, aid) for d, aid in db.query(Acesso.dia, Acesso.analista_id).filter(Acesso.tipo == "rede") if aid in ids]
    primeiro_dia = min([*criacao.values(), *(d for d, _ in visitas)], default=hoje)

    if dias:
        inicio = hoje - timedelta(days=dias - 1)
        anterior = (inicio - timedelta(days=dias), inicio - timedelta(days=1))
    else:
        inicio, anterior = primeiro_dia, None

    def no_periodo(d: date) -> bool:
        return inicio <= d <= hoje

    def no_anterior(d: date) -> bool:
        return anterior is not None and anterior[0] <= d <= anterior[1]

    def comparar(atual: int, contar_anterior) -> dict:
        return {"atual": atual, "anterior": contar_anterior() if anterior else None}

    # --- adesão ---
    novos = Counter(d for d in criacao.values() if no_periodo(d))
    antes_do_periodo = sum(1 for d in criacao.values() if d < inicio)
    cadastros, acumulado = [], antes_do_periodo
    for d in _serie(inicio, hoje):
        acumulado += novos.get(d, 0)
        cadastros.append({"dia": d.isoformat(), "novos": novos.get(d, 0), "acumulado": acumulado})

    dias_por_pessoa: dict[int, set[date]] = defaultdict(set)
    for d, aid in visitas:
        dias_por_pessoa[aid].add(d)

    etapas = [
        ("ativos", "Conta ativa", lambda a: True),
        ("sem_pendencias", "CPF e termos em dia", sem_pendencias),
        ("perfil_minimo", "Perfil mínimo (tema e órgão)", perfil_minimo),
        ("visitou", "Abriu a Rede", lambda a: a.id in dias_por_pessoa),
        ("voltou", "Voltou outro dia", lambda a: len(dias_por_pessoa.get(a.id, ())) >= 2),
    ]
    restantes, funil = list(ativos), []
    for chave, rotulo, teste in etapas:
        restantes = [a for a in restantes if teste(a)]
        funil.append({"chave": chave, "rotulo": rotulo, "total": len(restantes)})

    universo = db.scalar(select(func.count()).select_from(BaseAtps)) or 0

    # --- uso ---
    por_dia_visitas = Counter(d for d, _ in visitas if no_periodo(d))
    por_dia_pessoas = {d: len(s) for d, s in _pessoas_por_dia(visitas, no_periodo).items()}

    def pessoas_entre(a: date, b: date) -> int:
        return len({aid for d, aid in visitas if a <= d <= b})

    # retorno: de quem abriu a Rede pela primeira vez há 7 dias ou mais, quantos voltaram em até 7 dias
    elegiveis = voltaram = 0
    for dias_vistos in dias_por_pessoa.values():
        primeiro = min(dias_vistos)
        if primeiro <= hoje - timedelta(days=7):
            elegiveis += 1
            voltaram += any(primeiro < d <= primeiro + timedelta(days=7) for d in dias_vistos)

    favoritos = [(aid, fid, dia_brasilia(c)) for aid, fid, c in db.query(Favorito.analista_id, Favorito.favorito_id, Favorito.criado_em)
                 if aid in ids and fid in ids]

    semanas = 12
    seg_atual = hoje - timedelta(days=hoje.weekday())
    inicio_semanas = seg_atual - timedelta(weeks=semanas - 1)
    eventos = Counter()
    for tipo, analista_id, criado in db.query(EventoPerfil.tipo, EventoPerfil.analista_id, EventoPerfil.criado_em):
        d = dia_brasilia(criado)
        if analista_id in ids and d >= inicio_semanas:
            eventos[(d - timedelta(days=d.weekday()), tipo)] += 1
    atualizacoes = [
        {"semana": (inicio_semanas + timedelta(weeks=i)).isoformat(),
         **{t: eventos.get((inicio_semanas + timedelta(weeks=i), t), 0) for t in ("lotacao", "tema", "formacao")}}
        for i in range(semanas)
    ]

    emails = Counter()
    tipos_email = set()
    for tipo, enviado in db.query(EnvioEmail.tipo, EnvioEmail.enviado_em):
        d = dia_brasilia(enviado)
        if no_periodo(d):
            emails[(d, tipo)] += 1
            tipos_email.add(tipo)
    from email_utils import LIMITE_POR_DIA

    # --- perfis (retrato de agora) ---
    orgaos = ResolvedorOrgao(db)
    por_orgao = Counter(orgaos.orgao_id(a) for a in ativos)
    dist_orgao = agrupar([(orgaos.rotulo(o), n, f"orgao_id={o}") for o, n in por_orgao.items() if o is not None])
    if por_orgao.get(None):
        dist_orgao.append({"rotulo": SEM_ORGAO, "total": por_orgao[None], "filtro": None})

    contagem_temas = Counter()
    nomes_tema = {t.id: t.nome for t in db.scalars(select(Tema).where(Tema.reprovado.is_(False)))}
    for a in ativos:
        for tid in {t.tema_id for t in a.temas if t.tema_id in nomes_tema}:
            contagem_temas[tid] += 1
    dist_temas = agrupar([(nomes_tema[t], n, f"tema_id={t}") for t, n in contagem_temas.items()])

    por_nivel = Counter(nivel_mais_alto(a) for a in ativos)
    chave_nivel = {rotulo: nivel.value for nivel, rotulo in NIVEIS}
    dist_formacao = agrupar(
        [(rotulo, por_nivel.get(rotulo, 0), f"nivel={chave_nivel[rotulo]}") for _, rotulo in NIVEIS]
        + [("Sem formação", por_nivel.get(None, 0), "sem=formacao")],
        top=None, ordenar=False,
    )

    por_turma = Counter(a.turma.value if a.turma else None for a in ativos)
    dist_turma = agrupar(
        [(rotulo, por_turma.get(valor, 0), f"turma={valor}") for valor, rotulo in TURMAS.items()]
        + [("Não informada", por_turma.get(None, 0), "turma=nenhuma")],
        top=None, ordenar=False,
    )

    completude = [
        {"chave": k, "rotulo": r, "total": sum(1 for a in ativos if tem_item(a, k))} for k, r in ITENS_PERFIL.items()
    ]

    return {
        "gerado_em": datetime.now(timezone.utc),
        "dias": dias,
        "inicio": inicio.isoformat(),
        "fim": hoje.isoformat(),
        "minimo_grupo": MINIMO_GRUPO,
        "adesao": {
            "ativos": len(ativos),
            "novos": comparar(sum(novos.values()), lambda: sum(1 for d in criacao.values() if no_anterior(d))),
            "universo": universo,
            "funil": funil,
            "cadastros_por_dia": cadastros,
        },
        "uso": {
            "visitas": comparar(sum(por_dia_visitas.values()), lambda: sum(1 for d, _ in visitas if no_anterior(d))),
            "pessoas": comparar(pessoas_entre(inicio, hoje), lambda: pessoas_entre(*anterior)),
            "semana": pessoas_entre(hoje - timedelta(days=6), hoje),
            "mes": pessoas_entre(hoje - timedelta(days=29), hoje),
            "retorno": {"voltaram": voltaram, "elegiveis": elegiveis},
            "visitas_por_dia": [
                {"dia": d.isoformat(), "visitas": por_dia_visitas.get(d, 0), "pessoas": por_dia_pessoas.get(d, 0)}
                for d in _serie(inicio, hoje)
            ],
            "favoritos": {
                "total": len(favoritos),
                "pessoas": len({aid for aid, _, _ in favoritos}),
                "novos": comparar(sum(1 for *_, d in favoritos if no_periodo(d)),
                                  lambda: sum(1 for *_, d in favoritos if no_anterior(d))),
            },
            "atualizacoes_por_semana": atualizacoes,
            "emails_limite_dia": LIMITE_POR_DIA,
            "emails_tipos": sorted(tipos_email),
            "emails_por_dia": [
                {"dia": d.isoformat(), **{t: emails.get((d, t), 0) for t in tipos_email}} for d in _serie(inicio, hoje)
            ],
        },
        "perfis": {
            "ativos": len(ativos),
            "ocultos": sum(1 for a in ativos if a.perfil_oculto),
            "com_funcao": sum(1 for a in ativos if _preenchido(a.cargo_fce)),
            "completos": sum(1 for a in ativos if all(tem_item(a, k) for k in ITENS_PERFIL)),
            "completude": completude,
            "por_orgao": dist_orgao,
            "por_formacao": dist_formacao,
            "por_tema": dist_temas,
            "por_turma": dist_turma,
        },
    }


def _pessoas_por_dia(visitas, filtro) -> dict[date, set[int]]:
    saida: dict[date, set[int]] = defaultdict(set)
    for d, aid in visitas:
        if filtro(d):
            saida[d].add(aid)
    return saida
