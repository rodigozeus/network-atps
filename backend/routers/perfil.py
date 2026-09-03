import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from database import get_db
from models import Analista, Formacao, TemaAtuacao
from schemas import (
    AnalistaOut, AnalistaUpdate, AnalistaPublico,
    ExcluirContaIn,
    FormacaoBase, FormacaoOut,
    TemaBase, TemaOut,
)
from auth import get_current_user, verify_password

router = APIRouter(tags=["perfil"])

UPLOAD_DIR = "uploads/fotos"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


# --- Perfil próprio ---

@router.get("/perfil/me", response_model=AnalistaOut)
def get_meu_perfil(analista: Analista = Depends(get_current_user)):
    return analista


@router.put("/perfil/me", response_model=AnalistaOut)
def update_meu_perfil(
    body: AnalistaUpdate,
    analista: Analista = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(analista, field, value)
    db.commit()
    db.refresh(analista)
    return analista


@router.delete("/perfil/me", status_code=status.HTTP_204_NO_CONTENT)
def excluir_minha_conta(
    body: ExcluirContaIn,
    analista: Analista = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Exclusão definitiva da conta e de todos os dados pessoais, conforme LGPD."""
    if not verify_password(body.senha, analista.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Senha incorreta")

    if analista.foto_path and os.path.exists(analista.foto_path):
        os.remove(analista.foto_path)

    db.delete(analista)
    db.commit()


# --- Perfil público de outro analista ---

@router.get("/analistas/{analista_id}", response_model=AnalistaPublico)
def get_analista(
    analista_id: int,
    db: Session = Depends(get_db),
    _: Analista = Depends(get_current_user),  # exige autenticação
):
    analista = db.get(Analista, analista_id)
    if analista is None or not analista.ativo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista não encontrado")
    result = AnalistaPublico.model_validate(analista)
    if not analista.visibilidade_email_pessoal:
        result = result.model_copy(update={"email_pessoal": None})
    if not analista.visibilidade_celular:
        result = result.model_copy(update={"celular": None})
    return result


# --- Formações ---

@router.post("/perfil/formacao", response_model=FormacaoOut, status_code=status.HTTP_201_CREATED)
def add_formacao(
    body: FormacaoBase,
    analista: Analista = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    formacao = Formacao(analista_id=analista.id, **body.model_dump())
    db.add(formacao)
    db.commit()
    db.refresh(formacao)
    return formacao


@router.delete("/perfil/formacao/{formacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_formacao(
    formacao_id: int,
    analista: Analista = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    formacao = db.get(Formacao, formacao_id)
    if formacao is None or formacao.analista_id != analista.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formação não encontrada")
    db.delete(formacao)
    db.commit()


# --- Temas de atuação ---

@router.post("/perfil/tema", response_model=TemaOut, status_code=status.HTTP_201_CREATED)
def add_tema(
    body: TemaBase,
    analista: Analista = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tema = TemaAtuacao(analista_id=analista.id, **body.model_dump())
    db.add(tema)
    db.commit()
    db.refresh(tema)
    return tema


@router.delete("/perfil/tema/{tema_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tema(
    tema_id: int,
    analista: Analista = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tema = db.get(TemaAtuacao, tema_id)
    if tema is None or tema.analista_id != analista.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tema não encontrado")
    db.delete(tema)
    db.commit()


@router.get("/perfil/temas/sugestoes", response_model=list[str])
def sugestoes_temas(
    q: str = "",
    _: Analista = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sqlalchemy import select, func
    stmt = (
        select(TemaAtuacao.tema)
        .where(TemaAtuacao.tema.ilike(f"%{q}%"))
        .group_by(TemaAtuacao.tema)
        .order_by(func.count().desc(), TemaAtuacao.tema)
        .limit(8)
    )
    return list(db.scalars(stmt))


# --- Foto de perfil ---

@router.post("/perfil/foto", response_model=AnalistaOut)
def upload_foto(
    file: UploadFile = File(...),
    analista: Analista = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato inválido. Use JPEG, PNG ou WebP.",
        )
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = (file.filename or "foto").rsplit(".", 1)[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    if analista.foto_path and os.path.exists(analista.foto_path):
        os.remove(analista.foto_path)

    analista.foto_path = filepath
    db.commit()
    db.refresh(analista)
    return analista
