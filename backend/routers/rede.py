"""Novidades da rede (quem chegou na sua unidade ou na sua turma) e números públicos."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import get_usuario_regular
from database import get_db
from models import Analista, UnidadeSiorg, condicao_perfil_visivel
from routers.busca import _aplicar_visibilidade
from schemas import NovidadesRedeOut, ResumoPublico

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
