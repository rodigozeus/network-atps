"""Novidades da rede (quem chegou na sua unidade ou na sua turma) e números públicos."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import get_current_user, get_usuario_regular
from database import get_db
from models import Acesso, Analista, Favorito, UnidadeSiorg, condicao_perfil_visivel
from routers.busca import _aplicar_visibilidade
from schemas import AnelOut, MinhaRedePaginaOut, NovidadesRedeOut, PessoaOrbita

router = APIRouter(tags=["rede"])

JANELA = timedelta(days=30)
LIMITE = 12


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



# --- Página "Minha rede": quem está mais perto de quem está logado ---

ANEIS = [
    ("coordenacao", "Na sua coordenação"),
    ("coordenacao_geral", "Na sua coordenação-geral"),
    ("departamento", "No seu departamento"),
    ("secretaria", "Na sua secretaria"),
    ("ministerio", "No seu ministério"),
    ("temas", "Temas em comum"),
    ("favoritos", "Seus favoritos"),
]
NIVEIS_LOTACAO = ["ministerio", "secretaria", "departamento", "coordenacao_geral", "coordenacao"]
SIGLA_DO_NIVEL = {"ministerio": "ministerio_sigla", "secretaria": "secretaria_sigla", "departamento": "departamento_sigla"}
POR_ANEL = 60
RECENTE = timedelta(days=30)


@router.get("/rede/pagina", response_model=MinhaRedePaginaOut)
def minha_rede_pagina(eu: Analista = Depends(get_usuario_regular), db: Session = Depends(get_db)):
    """Cada pessoa aparece uma vez, no anel da relação mais próxima com você: a unidade mais
    funda em comum; sem lotação em comum, temas em comum; senão, se for sua favorita."""
    from routers.perfil import _chave, _lotacao_comum

    agora = datetime.now(timezone.utc)
    meus_temas = {_chave(t.tema): t.tema.strip() for t in eu.temas}
    favoritos = set(db.scalars(select(Favorito.favorito_id).where(Favorito.analista_id == eu.id)))
    outros = db.query(Analista).filter(condicao_perfil_visivel(), Analista.id != eu.id).all()

    grupos: dict[str, list] = {chave: [] for chave, _ in ANEIS}
    for c in outros:
        comuns = sorted({meus_temas[k] for k in (_chave(t.tema) for t in c.temas) if k in meus_temas})
        lot = _lotacao_comum(eu, c)
        fav = c.id in favoritos
        anel = lot[0] if lot else ("temas" if comuns else ("favoritos" if fav else None))
        if anel:
            recente = _como_utc(c.criado_em) > agora - RECENTE if c.criado_em else False
            grupos[anel].append((-len(comuns), not fav, c.nome.casefold(), c, comuns, fav, recente))

    aneis = []
    for chave, titulo in ANEIS:
        lista = sorted(grupos[chave], key=lambda x: x[:3])
        if not lista:
            continue
        unidade = None
        if chave in NIVEIS_LOTACAO:
            unidade = getattr(eu, SIGLA_DO_NIVEL[chave]) if chave in SIGLA_DO_NIVEL else None
            unidade = unidade or getattr(eu, chave)
        aneis.append(AnelOut(
            chave=chave, titulo=titulo, unidade=unidade, total=len(lista),
            pessoas=[PessoaOrbita(analista=_aplicar_visibilidade(c), temas_comuns=comuns, favorito=fav, recente=rec)
                     for *_, c, comuns, fav, rec in lista[:POR_ANEL]],
        ))

    recentes = sorted(
        (x for chave, _ in ANEIS for x in grupos[chave] if x[-1]),
        key=lambda x: _como_utc(x[3].criado_em), reverse=True,
    )
    return MinhaRedePaginaOut(
        eu=_aplicar_visibilidade(eu), aneis=aneis,
        recentes=[_aplicar_visibilidade(x[3]) for x in recentes[:12]],
    )


# --- Visitas (só contagem, para o painel) ---

def _hoje_brasilia():
    return (datetime.now(timezone.utc) - timedelta(hours=3)).date()


@router.post("/rede/visita", status_code=status.HTTP_204_NO_CONTENT)
def registrar_visita(eu: Analista = Depends(get_current_user), db: Session = Depends(get_db)):
    """Chamada uma vez por sessão do navegador quando a pessoa abre a Rede logada."""
    db.add(Acesso(dia=_hoje_brasilia(), tipo="rede", analista_id=eu.id))
    db.commit()

