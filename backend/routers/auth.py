import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from models import Analista, ConflitoCadastro
from schemas import AnalistaCreate, AnalistaOut, EsqueciSenhaIn, RedefinirSenhaIn, RegistroOut
from auth import (
    hash_password, verify_password,
    set_auth_cookies, clear_auth_cookies,
    _decode_token, get_current_user,
)
from consentimentos import registrar_aceite_obrigatorios, validar_versoes
from cpf_utils import cifrar_cpf, hash_cpf, limpar_cpf
from email_utils import (
    enviar_email_redefinicao_senha,
    enviar_email_boas_vindas,
    enviar_email_cadastro_recebido,
    enviar_email_alerta_cpf_em_uso,
)
from portal_transparencia import MOTIVOS, StatusVerificacao, consultar_situacao_atps
import atualizacao
import lotacao_auto

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_TENTATIVAS_LOGIN = 5
BLOQUEIO_MINUTOS = 15
RESET_TOKEN_VALIDADE_HORAS = 1

MSG_ESQUECI_SENHA = "Se o e-mail informado estiver cadastrado, enviaremos instruções para redefinição de senha."


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/register", response_model=RegistroOut, status_code=status.HTTP_201_CREATED)
def register(
    body: AnalistaCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    validar_versoes(body.versoes)
    cpf_limpo = limpar_cpf(body.cpf)
    cpf_hash_valor = hash_cpf(cpf_limpo)

    # CPF já cadastrado: não cria a conta, registra a tentativa para revisão manual,
    # avisa o titular da conta existente e responde exatamente como um cadastro
    # pendente — assim a resposta não revela se o CPF está na Rede.
    existente = db.query(Analista).filter(Analista.cpf_hash == cpf_hash_valor).first()
    if existente:
        db.add(ConflitoCadastro(
            analista_id=existente.id,
            nome_informado=body.nome,
            email_informado=body.email_pessoal,
        ))
        db.commit()
        motivo = MOTIVOS[StatusVerificacao.inconclusivo]
        background_tasks.add_task(enviar_email_alerta_cpf_em_uso, existente.email_pessoal, existente.nome)
        background_tasks.add_task(enviar_email_cadastro_recebido, body.email_pessoal, body.nome, motivo)
        return RegistroOut(ativo=False, motivo=motivo)

    # Confirmação de vínculo ATPS é feita exclusivamente via Portal da Transparência.
    # Qualquer resultado que não seja uma confirmação positiva (CPF não encontrado, nome
    # divergente ou API indisponível) deixa o cadastro pendente de revisão manual.
    resultado = consultar_situacao_atps(cpf_limpo, body.nome)
    agora = datetime.now(timezone.utc)

    analista = Analista(
        nome=body.nome,
        email_pessoal=body.email_pessoal,
        telefone_institucional=body.telefone_institucional,
        senha_hash=hash_password(body.senha),
        cpf_hash=cpf_hash_valor,
        cpf_cifrado=cifrar_cpf(cpf_limpo),
        cpf_verificado_em=agora if resultado.confirmado else None,
        termos_aceitos_em=agora,
        ativo=resultado.confirmado,
        pendente_revisao=not resultado.confirmado,
        motivo_pendencia=resultado.motivo,
    )
    registrar_aceite_obrigatorios(analista, request)
    db.add(analista)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="E-mail já cadastrado",
        )

    if resultado.confirmado:
        lotacao_auto.preencher(db, analista, resultado.exercicio)
        atualizacao.registrar(db, analista, resultado.exercicio)
        db.commit()

    if analista.ativo:
        background_tasks.add_task(enviar_email_boas_vindas, analista.email_pessoal, analista.nome)
    else:
        background_tasks.add_task(
            enviar_email_cadastro_recebido, analista.email_pessoal, analista.nome, resultado.motivo
        )

    return RegistroOut(ativo=analista.ativo, motivo=resultado.motivo)


@router.post("/login", status_code=status.HTTP_204_NO_CONTENT)
def login(response: Response, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
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
        )

    if analista.login_tentativas_falhas or analista.login_bloqueado_ate:
        analista.login_tentativas_falhas = 0
        analista.login_bloqueado_ate = None
        db.commit()

    if not analista.ativo:
        if analista.pendente_revisao:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Cadastro pendente de verificação. "
                    f"{analista.motivo_pendencia or MOTIVOS[StatusVerificacao.inconclusivo]} "
                    "Aguarde a análise de um administrador — você receberá um e-mail assim que sua conta for ativada."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta inativa. Entre em contato com um administrador.",
        )
    set_auth_cookies(response, analista.id)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    clear_auth_cookies(response)


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


@router.post("/refresh", status_code=status.HTTP_204_NO_CONTENT)
def refresh(response: Response, refresh_token: str | None = Cookie(None), db: Session = Depends(get_db)):
    analista_id = _decode_token(refresh_token, "refresh")
    analista = db.get(Analista, analista_id)
    if analista is None or not analista.ativo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida")
    set_auth_cookies(response, analista.id)


@router.get("/me", response_model=AnalistaOut)
def me(analista: Analista = Depends(get_current_user)):
    return analista
