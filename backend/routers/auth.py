import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from models import Analista
from schemas import AnalistaCreate, AnalistaOut, EsqueciSenhaIn, RedefinirSenhaIn, TokenOut
from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    _decode_token, get_current_user,
)
from cpf_utils import hash_cpf, limpar_cpf
from email_utils import enviar_email_redefinicao_senha
from portal_transparencia import consultar_situacao_atps
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_TENTATIVAS_LOGIN = 5
BLOQUEIO_MINUTOS = 15
RESET_TOKEN_VALIDADE_HORAS = 1

MSG_ESQUECI_SENHA = "Se o e-mail informado estiver cadastrado, enviaremos instruções para redefinição de senha."


class RefreshIn(BaseModel):
    refresh_token: str


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/register", response_model=AnalistaOut, status_code=status.HTTP_201_CREATED)
def register(body: AnalistaCreate, db: Session = Depends(get_db)):
    cpf_limpo = limpar_cpf(body.cpf)
    cpf_hash_valor = hash_cpf(cpf_limpo)

    if db.query(Analista).filter(Analista.cpf_hash == cpf_hash_valor).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="CPF já cadastrado")

    # Confirmação de vínculo ATPS é feita exclusivamente via Portal da Transparência.
    # Qualquer resultado que não seja uma confirmação positiva (CPF não encontrado, ou
    # API indisponível/não configurada) deixa o cadastro pendente de revisão manual.
    encontrado = consultar_situacao_atps(cpf_limpo) is True

    analista = Analista(
        nome=body.nome,
        email_pessoal=body.email_pessoal,
        telefone_institucional=body.telefone_institucional,
        senha_hash=hash_password(body.senha),
        cpf_hash=cpf_hash_valor,
        termos_aceitos_em=datetime.now(timezone.utc),
        ativo=encontrado,
        pendente_revisao=not encontrado,
    )
    db.add(analista)
    try:
        db.commit()
        db.refresh(analista)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="E-mail ou CPF já cadastrado",
        )
    return analista


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    analista = db.query(Analista).filter(
        Analista.email_pessoal == form.username
    ).first()

    agora = datetime.now(timezone.utc)
    if analista and analista.login_bloqueado_ate and analista.login_bloqueado_ate > agora:
        minutos_restantes = max(1, int((analista.login_bloqueado_ate - agora).total_seconds() // 60) + 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Muitas tentativas incorretas. Tente novamente em {minutos_restantes} minuto(s).",
        )

    if not analista or not verify_password(form.password, analista.senha_hash):
        if analista:
            analista.login_tentativas_falhas += 1
            if analista.login_tentativas_falhas >= MAX_TENTATIVAS_LOGIN:
                analista.login_bloqueado_ate = agora + timedelta(minutes=BLOQUEIO_MINUTOS)
                analista.login_tentativas_falhas = 0
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if analista.login_tentativas_falhas or analista.login_bloqueado_ate:
        analista.login_tentativas_falhas = 0
        analista.login_bloqueado_ate = None
        db.commit()

    if not analista.ativo:
        if analista.pendente_revisao:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cadastro pendente de verificação. Seu nome não foi encontrado na lista de ATPs. Aguarde a análise de um administrador.",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta inativa. Entre em contato com um administrador.",
        )
    return TokenOut(
        access_token=create_access_token(analista.id),
        refresh_token=create_refresh_token(analista.id),
    )


@router.post("/esqueci-senha")
def esqueci_senha(body: EsqueciSenhaIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    analista = db.query(Analista).filter(Analista.email_pessoal == body.email).first()
    if analista:
        token = secrets.token_urlsafe(32)
        analista.reset_token_hash = _hash_reset_token(token)
        analista.reset_token_expires_em = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_VALIDADE_HORAS)
        db.commit()
        background_tasks.add_task(
            enviar_email_redefinicao_senha, analista.email_pessoal, analista.nome, token
        )
    return {"detail": MSG_ESQUECI_SENHA}


@router.post("/redefinir-senha")
def redefinir_senha(body: RedefinirSenhaIn, db: Session = Depends(get_db)):
    token_hash = _hash_reset_token(body.token)
    agora = datetime.now(timezone.utc)
    analista = db.query(Analista).filter(
        Analista.reset_token_hash == token_hash,
        Analista.reset_token_expires_em.isnot(None),
        Analista.reset_token_expires_em > agora,
    ).first()
    if not analista:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link inválido ou expirado. Solicite uma nova redefinição de senha.",
        )
    analista.senha_hash = hash_password(body.senha)
    analista.reset_token_hash = None
    analista.reset_token_expires_em = None
    analista.login_tentativas_falhas = 0
    analista.login_bloqueado_ate = None
    db.commit()
    return {"detail": "Senha redefinida com sucesso."}


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    analista_id = _decode_token(body.refresh_token, "refresh")
    analista = db.get(Analista, analista_id)
    if analista is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
    return TokenOut(
        access_token=create_access_token(analista.id),
        refresh_token=create_refresh_token(analista.id),
    )


@router.get("/me", response_model=AnalistaOut)
def me(analista: Analista = Depends(get_current_user)):
    return analista
