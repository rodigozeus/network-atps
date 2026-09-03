from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
from cpf_utils import cpf_valido
from models import NivelFormacao, Role, Turma


# --- Formação ---

class FormacaoBase(BaseModel):
    nivel: NivelFormacao
    curso: str
    instituicao: str

class FormacaoOut(FormacaoBase):
    id: int
    model_config = {"from_attributes": True}


# --- Tema de Atuação ---

class TemaBase(BaseModel):
    tema: str
    em_exercicio_atual: bool = True

class TemaOut(TemaBase):
    id: int
    model_config = {"from_attributes": True}


# --- Analista ---

class AnalistaBase(BaseModel):
    nome: str
    email_pessoal: EmailStr
    telefone_institucional: str | None = None

class AnalistaCreate(AnalistaBase):
    senha: str
    cpf: str
    aceite_termos: bool

    @field_validator("cpf")
    @classmethod
    def _valida_cpf(cls, v: str) -> str:
        if not cpf_valido(v):
            raise ValueError("CPF inválido")
        return v

    @field_validator("aceite_termos")
    @classmethod
    def _valida_aceite(cls, v: bool) -> bool:
        if not v:
            raise ValueError(
                "É necessário concordar com o Termo de Consentimento (LGPD) para se cadastrar"
            )
        return v

class AnalistaUpdate(BaseModel):
    """Todos os campos opcionais — PUT /perfil/me atualiza só o que vier."""
    nome: str | None = None
    email_pessoal: EmailStr | None = None
    email_institucional: EmailStr | None = None
    telefone_institucional: str | None = None
    celular: str | None = None
    visibilidade_email_pessoal: bool | None = None
    visibilidade_celular: bool | None = None
    ministerio: str | None = None
    ministerio_sigla: str | None = None
    secretaria: str | None = None
    secretaria_sigla: str | None = None
    departamento: str | None = None
    departamento_sigla: str | None = None
    coordenacao_geral: str | None = None
    coordenacao: str | None = None
    cargo_fce: str | None = None
    portal_url: str | None = None
    turma: Turma | None = None

class AnalistaPerfil(BaseModel):
    email_institucional: str | None = None
    celular: str | None = None
    visibilidade_email_pessoal: bool = False
    visibilidade_celular: bool = False
    ministerio: str | None = None
    ministerio_sigla: str | None = None
    secretaria: str | None = None
    secretaria_sigla: str | None = None
    departamento: str | None = None
    departamento_sigla: str | None = None
    coordenacao_geral: str | None = None
    coordenacao: str | None = None
    cargo_fce: str | None = None
    portal_url: str | None = None
    turma: Turma | None = None

class AnalistaOut(AnalistaBase, AnalistaPerfil):
    id: int
    role: Role
    ativo: bool
    pendente_revisao: bool = False
    foto_path: str | None = None
    criado_em: datetime
    atualizado_em: datetime
    formacoes: list[FormacaoOut] = []
    temas: list[TemaOut] = []
    model_config = {"from_attributes": True}

class AnalistaPublico(BaseModel):
    """Campos exibidos para outros analistas — respeita visibilidade."""
    id: int
    nome: str
    email_pessoal: str | None = None
    email_institucional: str | None = None
    telefone_institucional: str | None = None
    celular: str | None = None
    ministerio: str | None = None
    ministerio_sigla: str | None = None
    secretaria: str | None = None
    secretaria_sigla: str | None = None
    departamento: str | None = None
    departamento_sigla: str | None = None
    coordenacao_geral: str | None = None
    coordenacao: str | None = None
    cargo_fce: str | None = None
    portal_url: str | None = None
    turma: Turma | None = None
    foto_path: str | None = None
    formacoes: list[FormacaoOut] = []
    temas: list[TemaOut] = []
    model_config = {"from_attributes": True}


# --- Busca ---

class BuscaResponse(BaseModel):
    items: list[AnalistaPublico]
    total: int
    page: int
    page_size: int
    pages: int


# --- Admin ---

class AnalistaAdminOut(BaseModel):
    id: int
    nome: str
    email_pessoal: str
    email_institucional: str | None = None
    telefone_institucional: str | None = None
    celular: str | None = None
    ministerio: str | None = None
    ministerio_sigla: str | None = None
    secretaria: str | None = None
    secretaria_sigla: str | None = None
    departamento: str | None = None
    departamento_sigla: str | None = None
    coordenacao_geral: str | None = None
    coordenacao: str | None = None
    cargo_fce: str | None = None
    portal_url: str | None = None
    turma: Turma | None = None
    foto_path: str | None = None
    role: Role
    ativo: bool
    pendente_revisao: bool = False
    criado_em: datetime
    atualizado_em: datetime
    formacoes: list[FormacaoOut] = []
    temas: list[TemaOut] = []
    model_config = {"from_attributes": True}


class AnalistaAdminUpdate(BaseModel):
    nome: str | None = None
    email_pessoal: EmailStr | None = None
    email_institucional: EmailStr | None = None
    telefone_institucional: str | None = None
    celular: str | None = None
    ministerio: str | None = None
    ministerio_sigla: str | None = None
    secretaria: str | None = None
    secretaria_sigla: str | None = None
    departamento: str | None = None
    departamento_sigla: str | None = None
    coordenacao_geral: str | None = None
    coordenacao: str | None = None
    cargo_fce: str | None = None
    portal_url: str | None = None
    turma: Turma | None = None
    role: Role | None = None
    ativo: bool | None = None


class PaginatedAdminUsers(BaseModel):
    items: list[AnalistaAdminOut]
    total: int
    page: int
    page_size: int
    pages: int


class MinistrioStat(BaseModel):
    ministerio_sigla: str | None
    total: int


class FormacaoStat(BaseModel):
    nivel: str
    total: int


class TemaStat(BaseModel):
    tema: str
    total: int


class AdminStats(BaseModel):
    total_analistas: int
    total_ativos: int
    total_inativos: int
    por_ministerio: list[MinistrioStat]
    por_nivel_formacao: list[FormacaoStat]
    por_tema: list[TemaStat]


# --- Auth ---

class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginIn(BaseModel):
    email: EmailStr
    senha: str

class EsqueciSenhaIn(BaseModel):
    email: EmailStr

class RedefinirSenhaIn(BaseModel):
    token: str
    senha: str = Field(min_length=8)

class ExcluirContaIn(BaseModel):
    senha: str
