from datetime import datetime
from urllib.parse import urlparse
from pydantic import BaseModel, EmailStr, field_validator
from cpf_utils import cpf_valido
from models import AcaoConsentimento, NivelFormacao, Role, Turma


SENHA_MIN_CARACTERES = 8
SENHA_MAX_BYTES = 72  # limite do bcrypt: bytes além disso são ignorados


def validar_senha(v: str) -> str:
    if len(v) < SENHA_MIN_CARACTERES:
        raise ValueError(f"A senha deve ter pelo menos {SENHA_MIN_CARACTERES} caracteres")
    if len(v.encode()) > SENHA_MAX_BYTES:
        raise ValueError("A senha é longa demais (máximo de 72 bytes)")
    return v


def validar_portal_url(v: str | None) -> str | None:
    """Só aceita links https de domínios do governo (*.gov.br)."""
    if v is None or v.strip() == "":
        return None
    v = v.strip()
    url = urlparse(v)
    host = (url.hostname or "").lower()
    if url.scheme != "https" or not (host == "gov.br" or host.endswith(".gov.br")):
        raise ValueError("O link deve começar com https:// e ser de um site .gov.br (ex.: SouGov)")
    return v


def _validar_link(v: str | None, esquemas: set[str], dominio: str, mensagem: str) -> str | None:
    if v is None or v.strip() == "":
        return None
    v = v.strip()
    url = urlparse(v)
    host = (url.hostname or "").lower()
    if url.scheme not in esquemas or not (host == dominio or host.endswith(f".{dominio}")):
        raise ValueError(mensagem)
    return v


def validar_linkedin_url(v: str | None) -> str | None:
    """Só aceita links https de linkedin.com."""
    return _validar_link(v, {"https"}, "linkedin.com",
                         "O link do LinkedIn deve começar com https://www.linkedin.com/")


def validar_lattes_url(v: str | None) -> str | None:
    """Só aceita links de lattes.cnpq.br; http:// é convertido para https://."""
    v = _validar_link(v, {"http", "https"}, "lattes.cnpq.br",
                      "O link do Currículo Lattes deve ser de lattes.cnpq.br")
    if v and v.lower().startswith("http://"):
        v = "https://" + v[len("http://"):]
    return v


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
    aceite_consulta_cpf: bool
    # Versões dos documentos exibidas ao usuário, por tipo — precisam ser as vigentes.
    versoes: dict[str, int]

    @field_validator("senha")
    @classmethod
    def _valida_senha(cls, v: str) -> str:
        return validar_senha(v)

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

    @field_validator("aceite_consulta_cpf")
    @classmethod
    def _valida_consulta_cpf(cls, v: bool) -> bool:
        if not v:
            raise ValueError("É necessário autorizar a consulta do CPF para se cadastrar")
        return v


class RegularizarIn(BaseModel):
    """Atualização cadastral exigida no login (CPF e/ou reaceite dos termos)."""
    cpf: str | None = None
    aceite_termos: bool = False
    aceite_consulta_cpf: bool = False
    versoes: dict[str, int] = {}

    @field_validator("cpf")
    @classmethod
    def _valida_cpf(cls, v: str | None) -> str | None:
        if v is not None and not cpf_valido(v):
            raise ValueError("CPF inválido")
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
    perfil_oculto: bool | None = None
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
    linkedin_url: str | None = None
    lattes_url: str | None = None
    turma: Turma | None = None

    @field_validator("portal_url")
    @classmethod
    def _valida_portal_url(cls, v: str | None) -> str | None:
        return validar_portal_url(v)

    @field_validator("linkedin_url")
    @classmethod
    def _valida_linkedin_url(cls, v: str | None) -> str | None:
        return validar_linkedin_url(v)

    @field_validator("lattes_url")
    @classmethod
    def _valida_lattes_url(cls, v: str | None) -> str | None:
        return validar_lattes_url(v)

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
    linkedin_url: str | None = None
    lattes_url: str | None = None
    turma: Turma | None = None

class AnalistaOut(AnalistaBase, AnalistaPerfil):
    id: int
    role: Role
    ativo: bool
    pendente_revisao: bool = False
    perfil_oculto: bool = False
    pendencias: list[str] = []
    motivo_pendencia: str | None = None
    vinculo_suspenso_em: datetime | None = None
    vinculo_exclusao_em: datetime | None = None
    foto_path: str | None = None
    # "portal": lotação preenchida automaticamente, ainda não alterada pelo titular
    lotacao_origem: str | None = None
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
    linkedin_url: str | None = None
    lattes_url: str | None = None
    turma: Turma | None = None
    foto_path: str | None = None
    formacoes: list[FormacaoOut] = []
    temas: list[TemaOut] = []
    model_config = {"from_attributes": True}


# --- Busca ---

class LotacaoOut(BaseModel):
    nome: str
    sigla: str | None
    total: int


class TemaCatalogoOut(BaseModel):
    tema: str
    total: int


class LotacaoComumOut(BaseModel):
    nivel: str  # ministerio | secretaria | departamento | coordenacao_geral | coordenacao
    nome: str


class ProximoOut(BaseModel):
    analista: AnalistaPublico
    temas_comuns: list[str]
    lotacao_comum: LotacaoComumOut | None


class EventoPerfilOut(BaseModel):
    tipo: str
    descricao: str
    criado_em: datetime
    model_config = {"from_attributes": True}


class NovidadesOut(BaseModel):
    analista_id: int
    eventos: list[EventoPerfilOut]


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
    linkedin_url: str | None = None
    lattes_url: str | None = None
    turma: Turma | None = None
    foto_path: str | None = None
    role: Role
    ativo: bool
    pendente_revisao: bool = False
    motivo_pendencia: str | None = None
    perfil_oculto: bool = False
    cpf_verificado_em: datetime | None = None
    vinculo_manual: bool = False
    vinculo_suspenso_em: datetime | None = None
    vinculo_exclusao_em: datetime | None = None
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
    linkedin_url: str | None = None
    lattes_url: str | None = None
    turma: Turma | None = None
    role: Role | None = None
    ativo: bool | None = None

    @field_validator("portal_url")
    @classmethod
    def _valida_portal_url(cls, v: str | None) -> str | None:
        return validar_portal_url(v)

    @field_validator("linkedin_url")
    @classmethod
    def _valida_linkedin_url(cls, v: str | None) -> str | None:
        return validar_linkedin_url(v)

    @field_validator("lattes_url")
    @classmethod
    def _valida_lattes_url(cls, v: str | None) -> str | None:
        return validar_lattes_url(v)


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


class ConflitoCadastroOut(BaseModel):
    id: int
    analista_id: int
    analista_nome: str
    analista_email: str
    nome_informado: str
    email_informado: str
    resolvido: bool
    criado_em: datetime


# --- Documentos legais e consentimentos ---

class DocumentoOut(BaseModel):
    tipo: str
    versao: int
    vigente_desde: str
    titulo: str
    texto: str
    hash: str


class ConsentimentoOut(BaseModel):
    tipo: str
    acao: AcaoConsentimento
    documento_versao: int | None = None
    criado_em: datetime
    model_config = {"from_attributes": True}


# --- Auth ---

class RegistroOut(BaseModel):
    """Resposta do cadastro. Não devolve o perfil, para que um CPF já cadastrado
    produza a mesma resposta de um cadastro pendente."""
    ativo: bool
    motivo: str | None = None

class LoginIn(BaseModel):
    email: EmailStr
    senha: str

class EsqueciSenhaIn(BaseModel):
    email: EmailStr

class RedefinirSenhaIn(BaseModel):
    token: str
    senha: str

    @field_validator("senha")
    @classmethod
    def _valida_senha(cls, v: str) -> str:
        return validar_senha(v)

class ExcluirContaIn(BaseModel):
    senha: str
