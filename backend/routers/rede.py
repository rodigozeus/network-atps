"""Novidades da rede (quem chegou na sua unidade ou na sua turma) e números públicos."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import get_usuario_regular
from database import get_db
from models import Analista, Favorito, UnidadeSiorg, condicao_perfil_visivel
from routers.busca import _aplicar_visibilidade
from schemas import LigacaoRede, MinhaRedeOut, NoRede, NovidadesRedeOut, ResumoPublico

router = APIRouter(tags=["rede"])

JANELA = timedelta(days=30)
LIMITE = 12
# Abaixo disso, a página pública não mostra números (a Rede ainda parece vazia)
MINIMO_PARA_MOSTRAR = 30


def _chave(texto: str | None) -> str:
    return " ".join((texto or "").casefold().split())


def _como_utc(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


@router.get("/rede/novidades", response_model=NovidadesRedeOut)
def novidades_da_rede(eu: Analista = Depends(get_usuario_regular), db: Session = Depends(get_db)):
    """Quem entrou na Rede desde a sua última olhada (até 30 dias): na sua secretaria (ou
    no seu ministério, se não informou secretaria) e na sua turma."""
    agora = datetime.now(timezone.utc)
    desde = max(_como_utc(eu.novidades_rede_vistas_em or eu.criado_em), agora - JANELA)
    novos = (
        db.query(Analista)
        .filter(condicao_perfil_visivel(), Analista.id != eu.id, Analista.criado_em > desde)
        .order_by(Analista.criado_em.desc())
        .all()
    )

    unidade, mesma_unidade = None, []
    if _chave(eu.ministerio):
        if _chave(eu.secretaria):
            unidade = eu.secretaria_sigla or eu.secretaria
            mesma_unidade = [a for a in novos if _chave(a.ministerio) == _chave(eu.ministerio)
                             and _chave(a.secretaria) == _chave(eu.secretaria)]
        else:
            unidade = eu.ministerio_sigla or eu.ministerio
            mesma_unidade = [a for a in novos if _chave(a.ministerio) == _chave(eu.ministerio)]
    mesma_turma = [a for a in novos if eu.turma is not None and a.turma == eu.turma]

    return NovidadesRedeOut(
        unidade=unidade if mesma_unidade else None,
        chegaram_unidade=[_aplicar_visibilidade(a) for a in mesma_unidade[:LIMITE]],
        turma=eu.turma.value if eu.turma is not None and mesma_turma else None,
        chegaram_turma=[_aplicar_visibilidade(a) for a in mesma_turma[:LIMITE]],
    )


@router.post("/rede/novidades/visto", status_code=status.HTTP_204_NO_CONTENT)
def marcar_novidades_vistas(eu: Analista = Depends(get_usuario_regular), db: Session = Depends(get_db)):
    eu.novidades_rede_vistas_em = datetime.now(timezone.utc)
    db.commit()


@router.get("/publico/resumo", response_model=ResumoPublico)
def resumo_publico(db: Session = Depends(get_db)):
    """Números agregados para a página pública (sem login). Nada de perfis."""
    analistas = db.scalar(select(func.count()).select_from(Analista).where(condicao_perfil_visivel())) or 0
    if analistas < MINIMO_PARA_MOSTRAR:
        return ResumoPublico(analistas=None, orgaos=None)
    orgaos = db.scalar(
        select(func.count(func.distinct(UnidadeSiorg.orgao_id)))
        .select_from(Analista)
        .join(UnidadeSiorg, UnidadeSiorg.id == Analista.lotacao_siorg_id)
        .where(condicao_perfil_visivel())
    ) or 0
    return ResumoPublico(analistas=analistas, orgaos=orgaos or None)


# --- Minha rede: quem está logado no centro, as pessoas mais próximas ao redor ---

NIVEL_ROTULO = {
    "ministerio": "Mesmo ministério", "secretaria": "Mesma secretaria", "departamento": "Mesmo departamento",
    "coordenacao_geral": "Mesma coordenação-geral", "coordenacao": "Mesma coordenação",
}
LIGACOES_POR_PESSOA = 1  # poucas linhas: só a ligação mais forte de cada pessoa


@router.get("/rede/minha", response_model=MinhaRedeOut)
def minha_rede(
    limite: int = 18,
    eu: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    """Rede do topo da busca: você no centro; ao redor, quem está mais perto de você (lotação
    em comum primeiro, temas desempatando), depois seus favoritos e, se faltar gente, outras
    pessoas da Rede. As ligações entre as pessoas são reais: mesma unidade ou tema em comum."""
    from routers.perfil import PONTOS_LOTACAO, _chave, _lotacao_comum

    limite = max(4, min(limite, 24))
    meus_temas = {_chave(t.tema): t.tema.strip() for t in eu.temas}
    favoritos = set(db.scalars(select(Favorito.favorito_id).where(Favorito.analista_id == eu.id)))
    outros = db.query(Analista).filter(condicao_perfil_visivel(), Analista.id != eu.id).all()

    def relacao_comigo(c: Analista):
        comuns = sorted({meus_temas[k] for k in (_chave(t.tema) for t in c.temas) if k in meus_temas})
        lot = _lotacao_comum(eu, c)
        return comuns, lot

    pontuados = []
    for c in outros:
        comuns, lot = relacao_comigo(c)
        nivel = PONTOS_LOTACAO[lot[0]] if lot else 0
        fav = c.id in favoritos
        if nivel or comuns or fav:
            # lotação primeiro, temas desempatam, favorito no fim do critério; desempate estável
            chave = (-nivel, -len(comuns), not fav, (c.id * 7919) % 10007)
            pontuados.append((chave, c, comuns, lot, fav))
    pontuados.sort(key=lambda x: x[0])
    escolhidos = pontuados[:limite]

    # completa com outras pessoas (com foto primeiro), para a rede não ficar vazia
    if len(escolhidos) < limite:
        ja = {c.id for _, c, *_ in escolhidos}
        resto = sorted((c for c in outros if c.id not in ja),
                       key=lambda c: (c.foto_path is None, (c.id * 7919) % 10007))
        escolhidos += [((9, 0, True, 0), c, [], None, False) for c in resto[: limite - len(escolhidos)]]

    pessoas = []
    for i, (chave, c, comuns, lot, fav) in enumerate(escolhidos):
        if lot:
            relacao, motivo = "unidade", f"{NIVEL_ROTULO[lot[0]]}: {lot[1]}"
            if comuns:
                motivo += f" · Temas em comum: {', '.join(comuns)}"
        elif comuns:
            relacao, motivo = "tema", f"Temas em comum: {', '.join(comuns)}"
        elif fav:
            relacao, motivo = "favorito", "Nos seus favoritos"
        else:
            relacao, motivo = "rede", None
        proximidade = 1 - i / max(1, len(escolhidos))
        pessoas.append(NoRede(analista=_aplicar_visibilidade(c), relacao=relacao, motivo=motivo,
                              proximidade=round(proximidade, 3)))

    # ligações entre as pessoas: as mais fortes de cada uma
    pares = []
    lista = [c for _, c, *_ in escolhidos]
    temas = {c.id: {_chave(t.tema): t.tema.strip() for t in c.temas} for c in lista}
    for i, a in enumerate(lista):
        for b in lista[i + 1:]:
            lot = _lotacao_comum(a, b)
            comuns = sorted(temas[a.id][k] for k in temas[a.id].keys() & temas[b.id].keys())
            nivel = PONTOS_LOTACAO[lot[0]] if lot and lot[0] != "ministerio" else 0
            if not nivel and not comuns:
                continue
            forca = nivel * 2 + len(comuns) * 3
            if comuns and (len(comuns) * 3 >= nivel * 2):
                tipo, rotulo = "tema", f"Tema em comum: {comuns[0]}"
            else:
                tipo, rotulo = "unidade", f"{NIVEL_ROTULO[lot[0]]}: {lot[1]}"
            pares.append((forca, a.id, b.id, tipo, rotulo))
    pares.sort(key=lambda p: -p[0])
    grau: dict[int, int] = {}
    ligacoes = []
    for forca, a, b, tipo, rotulo in pares:
        if grau.get(a, 0) >= LIGACOES_POR_PESSOA or grau.get(b, 0) >= LIGACOES_POR_PESSOA:
            continue
        grau[a] = grau.get(a, 0) + 1
        grau[b] = grau.get(b, 0) + 1
        ligacoes.append(LigacaoRede(a=a, b=b, tipo=tipo, rotulo=rotulo))

    return MinhaRedeOut(eu=_aplicar_visibilidade(eu), pessoas=pessoas, ligacoes=ligacoes)
