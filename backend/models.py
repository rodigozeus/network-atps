import enum
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, and_
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class NivelFormacao(str, enum.Enum):
    graduacao = "graduacao"
    especializacao = "especializacao"
    mestrado = "mestrado"
    doutorado = "doutorado"
    pos_doutorado = "pos_doutorado"


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
    cpf_cifrado: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Última confirmação do vínculo no Portal da Transparência (ou por um administrador).
    cpf_verificado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Vínculo confirmado manualmente por admin: a reverificação não suspende a conta.
    vinculo_manual: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Reverificação não confirmou o vínculo: perfil oculto até confirmação ou exclusão.
    vinculo_suspenso_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Legado: data do aceite antes do versionamento (ver tabela consentimentos).
    termos_aceitos_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.analista, nullable=False)

    # Contato
    email_pessoal: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    email_institucional: Mapped[str | None] = mapped_column(String(200), nullable=True)
    telefone_institucional: Mapped[str | None] = mapped_column(String(30), nullable=True)
    celular: Mapped[str | None] = mapped_column(String(30), nullable=True)
    visibilidade_email_pessoal: Mapped[bool] = mapped_column(Boolean, default=False)
    visibilidade_celular: Mapped[bool] = mapped_column(Boolean, default=False)
    perfil_oculto: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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
    # "portal" quando a lotação foi preenchida automaticamente com o órgão e a unidade de
    # exercício do Portal da Transparência; volta a None quando o titular a altera.
    lotacao_origem: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Unidade mais funda da lotação na estrutura oficial (UnidadeSiorg.id). Permite propagar
    # renomeações do SIORG e montar as páginas de unidade.
    lotacao_siorg_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    # "portal" quando cargo/turma vieram do Portal e ainda não foram alterados pelo titular
    cargo_origem: Mapped[str | None] = mapped_column(String(20), nullable=True)
    turma_origem: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Perfil sempre atualizado: mudança vista no Portal, aguardando o titular aceitar ou descartar
    sugestao_atualizacao: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    sugestao_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sugestao_descartada: Mapped[str | None] = mapped_column(String(64), nullable=True)  # assinatura
    conferido_portal_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    novidades_rede_vistas_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Complementar
    cargo_fce: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pode_ajudar: Mapped[str | None] = mapped_column(Text, nullable=True)  # "Em que posso ajudar"
    portal_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    lattes_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    turma: Mapped[Turma | None] = mapped_column(Enum(Turma), nullable=True)
    foto_path: Mapped[str | None] = mapped_column(String(300), nullable=True)

    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    pendente_revisao: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    motivo_pendencia: Mapped[str | None] = mapped_column(String(300), nullable=True)
    termo_versao_notificada: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    formacoes: Mapped[list["Formacao"]] = relationship(back_populates="analista", cascade="all, delete-orphan")
    temas: Mapped[list["TemaAtuacao"]] = relationship(back_populates="analista", cascade="all, delete-orphan")
    consentimentos: Mapped[list["Consentimento"]] = relationship(
        back_populates="analista", cascade="all, delete-orphan", order_by="Consentimento.id",
    )

    def versao_aceita(self, tipo: str) -> int | None:
        """Versão do documento aceita mais recentemente e não revogada depois."""
        for c in reversed(self.consentimentos):
            if c.tipo == tipo:
                return c.documento_versao if c.acao == AcaoConsentimento.aceito else None
        return None

    @property
    def pendencias(self) -> list[str]:
        """O que impede o uso da Rede até ser resolvido:
        cpf     — conta sem CPF guardado (anterior à criptografia do CPF);
        termos  — documento obrigatório não aceito na versão atual;
        vinculo — reverificação não confirmou o vínculo (perfil oculto)."""
        from documentos_legais import OBRIGATORIOS, documento_atual
        pendencias = []
        if self.cpf_cifrado is None:
            pendencias.append("cpf")
        if any(self.versao_aceita(t) != documento_atual(t).versao for t in OBRIGATORIOS):
            pendencias.append("termos")
        if self.vinculo_suspenso_em is not None:
            pendencias.append("vinculo")
        return pendencias

    @property
    def perfil_visivel(self) -> bool:
        """Aparece para outros usuários: conta ativa, não oculta pelo titular e
        sem vínculo suspenso. Mesma regra de `condicao_perfil_visivel()`."""
        return self.ativo and not self.perfil_oculto and self.vinculo_suspenso_em is None

    @property
    def vinculo_exclusao_em(self) -> datetime | None:
        from documentos_legais import PRAZO_CONTESTACAO_DIAS
        if self.vinculo_suspenso_em is None:
            return None
        return self.vinculo_suspenso_em + timedelta(days=PRAZO_CONTESTACAO_DIAS)


def condicao_perfil_visivel():
    return and_(
        Analista.ativo.is_(True),
        Analista.perfil_oculto.is_(False),
        Analista.vinculo_suspenso_em.is_(None),
    )


class AcaoConsentimento(str, enum.Enum):
    aceito = "aceito"
    revogado = "revogado"


class Consentimento(Base):
    """Registro de cada aceite ou revogação (prova do consentimento — art. 8º, § 2º, LGPD).
    Para documentos legais, guarda a versão e o hash do texto aceito."""
    __tablename__ = "consentimentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    analista_id: Mapped[int] = mapped_column(ForeignKey("analistas.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    acao: Mapped[AcaoConsentimento] = mapped_column(Enum(AcaoConsentimento), nullable=False)
    documento_versao: Mapped[int | None] = mapped_column(Integer, nullable=True)
    documento_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    analista: Mapped["Analista"] = relationship(back_populates="consentimentos")


class Formacao(Base):
    __tablename__ = "formacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    analista_id: Mapped[int] = mapped_column(ForeignKey("analistas.id"), nullable=False)
    nivel: Mapped[NivelFormacao] = mapped_column(Enum(NivelFormacao), nullable=False)
    curso: Mapped[str] = mapped_column(String(200), nullable=False)
    instituicao: Mapped[str] = mapped_column(String(200), nullable=False)

    analista: Mapped["Analista"] = relationship(back_populates="formacoes")


class ConflitoCadastro(Base):
    """Tentativa de cadastro com um CPF que já pertence a uma conta existente.
    Fica para revisão manual de um administrador."""
    __tablename__ = "conflitos_cadastro"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    analista_id: Mapped[int] = mapped_column(ForeignKey("analistas.id", ondelete="CASCADE"), nullable=False, index=True)
    nome_informado: Mapped[str] = mapped_column(String(200), nullable=False)
    email_informado: Mapped[str] = mapped_column(String(200), nullable=False)
    resolvido: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    analista: Mapped["Analista"] = relationship()


class Favorito(Base):
    """Quem (analista_id) favoritou quem (favorito_id). Visível só para quem favoritou.
    ON DELETE CASCADE nos dois sentidos: excluir a conta apaga os favoritos feitos e recebidos."""
    __tablename__ = "favoritos"

    analista_id: Mapped[int] = mapped_column(
        ForeignKey("analistas.id", ondelete="CASCADE"), primary_key=True
    )
    favorito_id: Mapped[int] = mapped_column(
        ForeignKey("analistas.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    # Última vez que quem favoritou viu as novidades deste perfil (None: desde criado_em).
    visto_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EventoPerfil(Base):
    """Mudança relevante num perfil (lotação, novo tema, nova formação), mostrada como
    novidade a quem favoritou a pessoa. Apagada após novidades.RETENCAO_DIAS."""
    __tablename__ = "eventos_perfil"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analista_id: Mapped[int] = mapped_column(
        ForeignKey("analistas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # lotacao | tema | formacao
    # Id do tema ou da formação: se o item for removido, a novidade some junto.
    ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    descricao: Mapped[str] = mapped_column(String(500), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)


class UnidadeSiorg(Base):
    """Estrutura organizacional oficial do Poder Executivo federal (SIORG), copiada pela
    tarefa diária (siorg.py). Profundidade 0 = órgão (ministério); 1 a 4 correspondem a
    secretaria, departamento, coordenação-geral e coordenação nos campos do perfil."""
    __tablename__ = "unidades_siorg"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)  # código SIORG
    pai_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    orgao_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(400), nullable=False)
    sigla: Mapped[str | None] = mapped_column(String(60), nullable=True)
    profundidade: Mapped[int] = mapped_column(Integer, nullable=False)


class UnidadeSiorgDetalhe(Base):
    """Competência, contato e endereço de uma unidade, buscados no SIORG sob demanda."""
    __tablename__ = "unidades_siorg_detalhe"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    competencia: Mapped[str | None] = mapped_column(Text, nullable=True)
    contato: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    endereco: Mapped[str | None] = mapped_column(Text, nullable=True)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class BaseAtps(Base):
    """Cópia dos ATPS ativos do download em massa do Portal da Transparência (SIAPE).
    Usada quando a API do Portal está fora do ar (verificação e preenchimento) e como
    universo do painel de cobertura. Do CPF fica só o HMAC dos 6 dígitos que o Portal
    divulga (o restante já vem mascarado na fonte)."""
    __tablename__ = "base_atps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)  # Id_SERVIDOR_PORTAL
    cpf_meio_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    cod_org_exercicio: Mapped[str | None] = mapped_column(String(10), nullable=True)
    org_exercicio: Mapped[str | None] = mapped_column(String(200), nullable=True)
    uorg_exercicio: Mapped[str | None] = mapped_column(String(200), nullable=True)
    orgao_siorg_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    funcao_sigla: Mapped[str | None] = mapped_column(String(10), nullable=True)
    funcao_nivel: Mapped[str | None] = mapped_column(String(10), nullable=True)
    atividade: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ano_ingresso_servico_publico: Mapped[int | None] = mapped_column(Integer, nullable=True)
    referencia: Mapped[str] = mapped_column(String(6), nullable=False)  # AAAAMM


class EnvioEmail(Base):
    """Registro de envios para o limite por hora/dia (sem destinatário nem conteúdo)."""
    __tablename__ = "envios_email"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo: Mapped[str] = mapped_column(String(40), nullable=False)
    essencial: Mapped[bool] = mapped_column(Boolean, nullable=False)
    enviado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)


class Acesso(Base):
    """Uma visita: a primeira abertura da Rede numa sessão do navegador, com a conta. Alimenta as
    contagens e o log de acessos do painel. (O tipo "sobre", da antiga página pública, saiu.)"""
    __tablename__ = "acessos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dia: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(10), nullable=False)
    # conta excluída: a visita continua contando, sem a ligação com a pessoa
    analista_id: Mapped[int | None] = mapped_column(
        ForeignKey("analistas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Tema(Base):
    """Catálogo de temas: Áreas de política ("area") e Ferramentas e métodos ("ferramenta").
    Mantido pela curadoria do painel admin; temas criados por pessoas entram como não revisados."""
    __tablename__ = "temas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    tipo: Mapped[str] = mapped_column(String(12), nullable=False, default="area")
    apelidos: Mapped[str] = mapped_column(Text, nullable=False, default="")  # um por linha
    revisado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # reprovado pela curadoria: some das sugestões e o nome fica bloqueado para novos perfis
    reprovado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    criado_por_id: Mapped[int | None] = mapped_column(ForeignKey("analistas.id", ondelete="SET NULL"), nullable=True)

    @property
    def lista_apelidos(self) -> list[str]:
        return [a.strip() for a in (self.apelidos or "").splitlines() if a.strip()]


class TemaAtuacao(Base):
    __tablename__ = "temas_atuacao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    analista_id: Mapped[int] = mapped_column(ForeignKey("analistas.id"), nullable=False)
    # cópia do nome do tema do catálogo (busca, cards e novidades leem daqui); a curadoria
    # atualiza as cópias ao renomear ou juntar temas
    tema: Mapped[str] = mapped_column(String(200), nullable=False)
    tema_id: Mapped[int | None] = mapped_column(ForeignKey("temas.id"), nullable=True, index=True)
    em_exercicio_atual: Mapped[bool] = mapped_column(Boolean, default=True)

    analista: Mapped["Analista"] = relationship(back_populates="temas")
    catalogo: Mapped["Tema | None"] = relationship(lazy="joined")

    @property
    def tipo(self) -> str:
        return self.catalogo.tipo if self.catalogo else "area"
