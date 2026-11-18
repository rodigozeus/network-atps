from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import get_usuario_regular
from database import get_db
from models import Analista, Favorito, condicao_perfil_visivel

router = APIRouter(prefix="/favoritos", tags=["favoritos"])


@router.get("/ids", response_model=list[int])
def listar_ids(eu: Analista = Depends(get_usuario_regular), db: Session = Depends(get_db)):
    """Ids que eu favoritei, só entre perfis visíveis (ocultos ou suspensos não aparecem)."""
    stmt = (
        select(Favorito.favorito_id)
        .join(Analista, Analista.id == Favorito.favorito_id)
        .where(Favorito.analista_id == eu.id, condicao_perfil_visivel())
        .order_by(Favorito.criado_em.desc())
    )
    return list(db.scalars(stmt))


@router.put("/{analista_id}", status_code=status.HTTP_204_NO_CONTENT)
def favoritar(analista_id: int, eu: Analista = Depends(get_usuario_regular), db: Session = Depends(get_db)):
    alvo = db.get(Analista, analista_id)
    if alvo is None or not alvo.perfil_visivel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista não encontrado")
    if db.get(Favorito, (eu.id, analista_id)) is None:  # idempotente
        db.add(Favorito(analista_id=eu.id, favorito_id=analista_id))
        db.commit()


@router.delete("/{analista_id}", status_code=status.HTTP_204_NO_CONTENT)
def desfavoritar(analista_id: int, eu: Analista = Depends(get_usuario_regular), db: Session = Depends(get_db)):
    db.query(Favorito).filter_by(analista_id=eu.id, favorito_id=analista_id).delete()
    db.commit()
