from datetime import datetime, timedelta, timezone
from fastapi import Cookie, Depends, HTTPException, Response, status
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session
from database import get_db, settings
from models import Analista

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _create_token(data: dict, expire_days: int, token_type: str) -> str:
    payload = data.copy()
    payload.update({
        "exp": datetime.now(timezone.utc) + timedelta(days=expire_days),
        "type": token_type,
    })
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(analista_id: int) -> str:
    return _create_token(
        {"sub": str(analista_id)},
        settings.jwt_access_token_expire_days,
        "access",
    )


def create_refresh_token(analista_id: int) -> str:
    return _create_token(
        {"sub": str(analista_id)},
        settings.jwt_refresh_token_expire_days,
        "refresh",
    )


def set_auth_cookies(response: Response, analista_id: int) -> None:
    """Sessão em cookies HttpOnly (inacessíveis a JavaScript) e SameSite=Strict
    (não enviados em requisições originadas de outros sites, o que protege contra CSRF)."""
    comum = {"httponly": True, "secure": settings.cookie_secure, "samesite": "strict", "path": "/"}
    response.set_cookie(
        ACCESS_COOKIE, create_access_token(analista_id),
        max_age=settings.jwt_access_token_expire_days * 86400, **comum,
    )
    response.set_cookie(
        REFRESH_COOKIE, create_refresh_token(analista_id),
        max_age=settings.jwt_refresh_token_expire_days * 86400, **comum,
    )


def clear_auth_cookies(response: Response) -> None:
    for nome in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(nome, path="/", secure=settings.cookie_secure, httponly=True, samesite="strict")


def _decode_token(token: str | None, expected_type: str) -> int:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
    )
    if not token:
        raise credentials_error
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != expected_type:
            raise credentials_error
        sub = payload.get("sub")
        if sub is None:
            raise credentials_error
        return int(sub)
    except JWTError:
        raise credentials_error


def get_current_user(
    access_token: str | None = Cookie(None),
    db: Session = Depends(get_db),
) -> Analista:
    analista_id = _decode_token(access_token, "access")
    analista = db.get(Analista, analista_id)
    if analista is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
    if not analista.ativo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta inativa")
    return analista


def get_usuario_regular(analista: Analista = Depends(get_current_user)) -> Analista:
    """Usuário logado e sem pendências (CPF, aceite da versão atual dos termos,
    vínculo suspenso). Com pendências, só o próprio perfil, a regularização,
    a exclusão da conta e o logout ficam acessíveis."""
    if analista.pendencias:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Atualização cadastral pendente.",
        )
    return analista


def get_current_admin(analista: Analista = Depends(get_usuario_regular)) -> Analista:
    from models import Role
    if analista.role not in (Role.admin, Role.andeps):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores")
    return analista
