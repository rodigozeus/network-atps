"""Preenchimento automático da lotação com o órgão e a unidade de exercício do Portal da
Transparência, casados com a estrutura oficial do SIORG.

Só acontece com a Autorização de consulta do CPF v2 aceita, e só quando a lotação do
perfil está em branco. O ministério casa pela sigla (o Portal e o SIORG usam a mesma).
A unidade vem do SIAPE abreviada e truncada em 40 caracteres ("CGERAL DE INCL PROD, ENFR
A POB E A FOME"): casa quando cada palavra é prefixo da palavra oficial correspondente,
na ordem, e há um único melhor candidato. Na dúvida, preenche só o ministério.
"""
import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

import novidades
from documentos_legais import AUTORIZACAO_CONSULTA_CPF, VERSAO_AUTORIZACAO_AMPLIADA
from models import Analista, Turma, UnidadeSiorg
from portal_transparencia import Exercicio
from siorg import CAMPOS_ATE

VERSAO_MINIMA_AUTORIZACAO = 2

# Campos do perfil por profundidade na árvore do SIORG: (nome, sigla)
CAMPOS = {
    0: ("ministerio", "ministerio_sigla"),
    1: ("secretaria", "secretaria_sigla"),
    2: ("departamento", "departamento_sigla"),
    3: ("coordenacao_geral", None),
    4: ("coordenacao", None),
}

PALAVRAS_VAZIAS = {"A", "AS", "O", "OS", "DE", "DA", "DAS", "DO", "DOS", "E", "EM", "NA", "NAS", "NO", "NOS",
                   "PARA", "AO", "AOS", "COM", "POR", "SEM"}

# Tipo da unidade no início do nome, abreviado de várias formas no SIAPE
TIPOS = [
    (r"(COORDENACAO|COORD|COOR|COO)[ -]*GERAL|COORD[ -]*GER|CGERAL|C[ -]G|CG", "CG"),
    (r"SUBSECRETARIA|SUBSEC", "SUBSEC"),
    (r"SECRETARIA[ -]EXECUTIVA", "SE"),
    (r"SECRETARIA|SECRET|SEC", "SEC"),
    (r"DEPARTAMENTO|DEPTO|DEP", "DEP"),
    (r"DIRETORIA|DIRET|DIR", "DIR"),
    (r"COORDENACAO|COORD|COOR", "CO"),
    (r"ASSESSORIA|ASSES|ASS", "ASS"),
    (r"GABINETE|GAB", "GAB"),
    (r"DIVISAO|DIVI|DIV", "DIV"),
    (r"SERVICO|SERV", "SERV"),
]
_TIPO_RE = [(re.compile(rf"^(?:{p})\b[ -]*"), t) for p, t in TIPOS]


def normalizar(texto: str) -> str:
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", texto or "") if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^A-Z0-9 -]", " ", sem_acento.upper()).split())


def _separar(nome: str) -> tuple[str | None, list[str]]:
    """(tipo, palavras significativas)"""
    n = normalizar(nome)
    tipo = None
    for regex, t in _TIPO_RE:
        m = regex.match(n)
        if m:
            tipo, n = t, n[m.end():]
            break
    palavras = [p for p in re.split(r"[ -]+", n) if p and p not in PALAVRAS_VAZIAS]
    return tipo, palavras


def _abreviacao_de(curtas: list[str], longas: list[str]) -> bool:
    """Cada palavra curta é prefixo de uma palavra longa, na ordem, sem pular mais de uma."""
    if not curtas:
        return False
    j = pulos = 0
    for c in curtas:
        while j < len(longas) and not longas[j].startswith(c):
            j += 1
            pulos += 1
        if j == len(longas) or pulos > 1:
            return False
        j += 1
    return True


def casar_unidade(siape: str, candidatas: list[UnidadeSiorg]) -> UnidadeSiorg | None:
    tipo, palavras = _separar(siape)
    # uma palavra curta solta ("COORDENACAO SE") casaria com qualquer coisa
    if not palavras or (len(palavras) == 1 and len(palavras[0]) < 5):
        return None
    truncado = len(siape.strip()) >= 38  # o SIAPE corta em 40 caracteres
    achadas = []
    for u in candidatas:
        tipo_u, palavras_u = _separar(u.nome)
        if tipo and tipo_u and tipo != tipo_u:
            continue
        if not _abreviacao_de(palavras, palavras_u):
            continue
        # sem truncamento, a unidade oficial não pode ter palavras sobrando no fim
        if not truncado and len(palavras_u) > len(palavras) + 1:
            continue
        achadas.append((len(palavras_u) - len(palavras), u))
    if not achadas:
        return None
    # prefere a que deixa menos palavras oficiais sem correspondência; empate = ambíguo
    menor = min(sobra for sobra, _ in achadas)
    melhores = [u for sobra, u in achadas if sobra == menor]
    return melhores[0] if len(melhores) == 1 else None


def versao_autorizacao(a: Analista) -> int:
    return a.versao_aceita(AUTORIZACAO_CONSULTA_CPF) or 0


TURMAS_POR_ANO_INGRESSO = {
    # ano de ingresso no serviço público -> turma (concurso de 2012: posse em 2013-2014;
    # CPNU 2024: posse em 2025-2026). Fora disso (quem já era servidor antes), não infere.
    2013: Turma.turma_2012, 2014: Turma.turma_2012,
    2025: Turma.turma_2024_cpnu, 2026: Turma.turma_2024_cpnu,
}


def pode_preencher(a: Analista) -> bool:
    """Há algo em branco que o Portal pode preencher, com a autorização aceita para isso."""
    v = versao_autorizacao(a)
    lotacao = v >= VERSAO_MINIMA_AUTORIZACAO and not (a.ministerio or "").strip()
    ampliada = v >= VERSAO_AUTORIZACAO_AMPLIADA and (not (a.cargo_fce or "").strip() or a.turma is None)
    return lotacao or ampliada


# Nomes antigos que o SIAPE ainda usa para órgãos renomeados -> sigla atual no SIORG
APELIDOS_ORGAO = {
    "MINISTERIO DO MEIO AMBIENTE": "MMA",  # hoje: Ministério do Meio Ambiente e Mudança do Clima
    "MINISTERIO DA CIENCIA TECNOLOGIA INOVACOES E COMUNICACOES": "MCTI",  # hoje: ... e Inovação
}


def casar_orgao(nome: str | None, sigla: str | None, orgaos: list[UnidadeSiorg]) -> UnidadeSiorg | None:
    """Órgão do SIORG pela sigla, pelo nome igual ou pelo nome abreviado do SIAPE
    ("MIN DESENV ASSIS SOCI FAMIL COMBATE FOME")."""
    if sigla:
        s = [o for o in orgaos if (o.sigla or "").upper() == sigla.strip().upper()]
        if len(s) == 1:
            return s[0]
    if nome:
        n = normalizar(nome)
        apelido = APELIDOS_ORGAO.get(n)
        if apelido:
            achados = [o for o in orgaos if (o.sigla or "").upper() == apelido]
            if len(achados) == 1:
                return achados[0]
        e = [o for o in orgaos if normalizar(o.nome) == n]
        if len(e) == 1:
            return e[0]
        return casar_unidade(nome, orgaos)
    return None


def caminho_para(db: Session, ex: Exercicio) -> list[UnidadeSiorg]:
    """Caminho no SIORG (órgão > ... > unidade de exercício), até a profundidade dos campos
    do perfil. Vazio se o órgão não for encontrado; só o órgão se a unidade não casar."""
    orgao = db.get(UnidadeSiorg, ex.orgao_siorg_id) if ex.orgao_siorg_id else None
    if orgao is None:
        orgaos = list(db.scalars(select(UnidadeSiorg).where(UnidadeSiorg.profundidade == 0)))
        orgao = casar_orgao(ex.orgao_nome, ex.orgao_sigla, orgaos)
    if orgao is None:
        return []
    caminho = [orgao]
    if ex.unidade:
        candidatas = list(db.scalars(
            select(UnidadeSiorg).where(UnidadeSiorg.orgao_id == orgao.id, UnidadeSiorg.profundidade > 0)
        ))
        unidade = casar_unidade(ex.unidade, candidatas)
        if unidade is not None:
            por_id = {u.id: u for u in candidatas}
            cadeia = []
            atual = unidade
            while atual is not None and atual.profundidade > 0:
                cadeia.append(atual)
                atual = por_id.get(atual.pai_id)
            caminho += [u for u in reversed(cadeia) if u.profundidade <= CAMPOS_ATE]
    return caminho


def aplicar_lotacao(db: Session, a: Analista, caminho: list[UnidadeSiorg]) -> None:
    """Troca a lotação inteira pelo caminho oficial. Não faz commit."""
    antes = novidades.foto_lotacao(a)
    for nome, sigla in CAMPOS.values():
        setattr(a, nome, None)
        if sigla:
            setattr(a, sigla, None)
    for u in caminho:
        nome, sigla = CAMPOS[u.profundidade]
        setattr(a, nome, u.nome[:200])
        if sigla:
            setattr(a, sigla, (u.sigla or "")[:30] or None)
    a.lotacao_siorg_id = caminho[-1].id
    a.lotacao_origem = "portal"
    if a.id is not None:
        novidades.registrar_lotacao(db, a, antes)


def preencher(db: Session, a: Analista, ex: Exercicio | None) -> bool:
    """Preenche o que estiver em branco (lotação; com a autorização ampliada, também cargo
    e turma). Devolve True se mudou algo. Não faz commit."""
    if ex is None:
        return False
    v = versao_autorizacao(a)
    mudou = False
    if v >= VERSAO_MINIMA_AUTORIZACAO and not (a.ministerio or "").strip():
        caminho = caminho_para(db, ex)
        if caminho:
            aplicar_lotacao(db, a, caminho)
            mudou = True
    if v >= VERSAO_AUTORIZACAO_AMPLIADA:
        if ex.funcao and not (a.cargo_fce or "").strip():
            a.cargo_fce = ex.funcao[:100]
            a.cargo_origem = "portal"
            mudou = True
        turma = TURMAS_POR_ANO_INGRESSO.get(ex.ano_ingresso_servico_publico)
        if turma is not None and a.turma is None:
            a.turma = turma
            a.turma_origem = "portal"
            mudou = True
    return mudou
