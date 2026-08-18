from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session
from database import get_db, settings
from models import Analista

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


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


def _decode_token(token: str, expected_type: str) -> int:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
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


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Analista:
    analista_id = _decode_token(token, "access")
    analista = db.get(Analista, analista_id)
    if analista is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
    if not analista.ativo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta inativa")
    return analista


def get_current_admin(analista: Analista = Depends(get_current_user)) -> Analista:
    from models import Role
    if analista.role not in (Role.admin, Role.andeps):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores")
    return analista
