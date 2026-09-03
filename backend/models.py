import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class NivelFormacao(str, enum.Enum):
    graduacao = "graduacao"
    especializacao = "especializacao"
    mestrado = "mestrado"
    doutorado = "doutorado"


class Role(str, enum.Enum):
    analista = "analista"
    andeps = "andeps"
    admin = "admin"


class Turma(str, enum.Enum):
    turma_2012 = "turma_2012"
    turma_2016 = "turma_2016"
    turma_2024_cpnu = "turma_2024_cpnu"


def now_utc():
    return datetime.now(timezone.utc)


class Analista(Base):
    __tablename__ = "analistas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    cpf_hash: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    termos_aceitos_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.analista, nullable=False)

    # Contato
    email_pessoal: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    email_institucional: Mapped[str | None] = mapped_column(String(200), nullable=True)
    telefone_institucional: Mapped[str | None] = mapped_column(String(30), nullable=True)
    celular: Mapped[str | None] = mapped_column(String(30), nullable=True)
    visibilidade_email_pessoal: Mapped[bool] = mapped_column(Boolean, default=False)
    visibilidade_celular: Mapped[bool] = mapped_column(Boolean, default=False)

    # Segurança / autenticação
    reset_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    reset_token_expires_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    login_tentativas_falhas: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    login_bloqueado_ate: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Localização profissional
    ministerio: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ministerio_sigla: Mapped[str | None] = mapped_column(String(30), nullable=True)
    secretaria: Mapped[str | None] = mapped_column(String(200), nullable=True)
    secretaria_sigla: Mapped[str | None] = mapped_column(String(30), nullable=True)
    departamento: Mapped[str | None] = mapped_column(String(200), nullable=True)
    departamento_sigla: Mapped[str | None] = mapped_column(String(30), nullable=True)
    coordenacao_geral: Mapped[str | None] = mapped_column(String(200), nullable=True)
    coordenacao: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Complementar
    cargo_fce: Mapped[str | None] = mapped_column(String(100), nullable=True)
    portal_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    turma: Mapped[Turma | None] = mapped_column(Enum(Turma), nullable=True)
    foto_path: Mapped[str | None] = mapped_column(String(300), nullable=True)

    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    pendente_revisao: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    formacoes: Mapped[list["Formacao"]] = relationship(back_populates="analista", cascade="all, delete-orphan")
    temas: Mapped[list["TemaAtuacao"]] = relationship(back_populates="analista", cascade="all, delete-orphan")


class Formacao(Base):
    __tablename__ = "formacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    analista_id: Mapped[int] = mapped_column(ForeignKey("analistas.id"), nullable=False)
    nivel: Mapped[NivelFormacao] = mapped_column(Enum(NivelFormacao), nullable=False)
    curso: Mapped[str] = mapped_column(String(200), nullable=False)
    instituicao: Mapped[str] = mapped_column(String(200), nullable=False)

    analista: Mapped["Analista"] = relationship(back_populates="formacoes")


class TemaAtuacao(Base):
    __tablename__ = "temas_atuacao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    analista_id: Mapped[int] = mapped_column(ForeignKey("analistas.id"), nullable=False)
    tema: Mapped[str] = mapped_column(String(200), nullable=False)
    em_exercicio_atual: Mapped[bool] = mapped_column(Boolean, default=True)

    analista: Mapped["Analista"] = relationship(back_populates="temas")
