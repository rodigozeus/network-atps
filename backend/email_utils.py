import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText

from sqlalchemy import func, select

from database import SessionLocal, settings
from models import EnvioEmail

logger = logging.getLogger(__name__)

# Limite de envios (todos os tipos contam). Acima dele, só sai e-mail essencial:
# recuperação de senha, ativação de conta e avisos de segurança ou sobre o vínculo.
LIMITE_POR_HORA = 100
LIMITE_POR_DIA = 300


def _dentro_do_limite(db) -> bool:
    agora = datetime.now(timezone.utc)

    def contar(desde: datetime) -> int:
        stmt = select(func.count()).select_from(EnvioEmail).where(EnvioEmail.enviado_em >= desde)
        return db.scalar(stmt) or 0

    return contar(agora - timedelta(hours=1)) < LIMITE_POR_HORA and contar(agora - timedelta(days=1)) < LIMITE_POR_DIA


def _enviar_email(destinatario: str, assunto: str, corpo: str, tipo: str, essencial: bool = False) -> bool:
    """Envia e registra o envio (só o tipo e a hora, sem destinatário nem conteúdo)."""
    with SessionLocal() as db:
        if not essencial and not _dentro_do_limite(db):
            logger.warning("Limite de e-mails atingido: '%s' (não essencial) não enviado", tipo)
            return False
        enviado = _smtp(destinatario, assunto, corpo)
        if enviado:
            db.add(EnvioEmail(tipo=tipo, essencial=essencial))
            db.commit()
        return enviado


def _smtp(destinatario: str, assunto: str, corpo: str) -> bool:
    if not settings.smtp_host:
        logger.warning(
            "SMTP não configurado — e-mail '%s' para %s não enviado:\n%s",
            assunto, destinatario, corpo,
        )
        return False

    msg = MIMEText(corpo, "plain", "utf-8")
    msg["Subject"] = assunto
    msg["From"] = settings.smtp_from or settings.smtp_user or "no-reply@redeatps.org"
    msg["To"] = destinatario

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password or "")
            server.sendmail(msg["From"], [destinatario], msg.as_string())
        return True
    except Exception:
        logger.exception("Falha ao enviar e-mail '%s' para %s", assunto, destinatario)
        return False


def enviar_email_redefinicao_senha(destinatario: str, nome: str, token: str) -> None:
    link = f"{settings.frontend_url}/redefinir-senha?token={token}"
    corpo = (
        f"Olá, {nome}!\n\n"
        "Recebemos uma solicitação para redefinir sua senha na Rede ATPS.\n"
        "Clique no link abaixo para escolher uma nova senha (válido por 1 hora):\n\n"
        f"{link}\n\n"
        "Se você não solicitou essa redefinição, pode ignorar este e-mail."
    )
    _enviar_email(destinatario, "Redefinição de senha — Rede ATPS", corpo, "redefinicao_senha", essencial=True)


def enviar_email_boas_vindas(destinatario: str, nome: str) -> None:
    """Cadastro criado já ativo (vínculo confirmado no Portal da Transparência)."""
    link = f"{settings.frontend_url}/login"
    corpo = (
        f"Olá, {nome}!\n\n"
        "Seu cadastro na Rede ATPS foi criado e seu vínculo como ATPS foi confirmado "
        "automaticamente junto ao Portal da Transparência do Governo Federal.\n\n"
        "Sua conta já está ativa — você já pode acessar a plataforma:\n\n"
        f"{link}\n\n"
        "Bem-vindo(a) à Rede ATPS!"
    )
    _enviar_email(destinatario, "Bem-vindo(a) à Rede ATPS", corpo, "boas_vindas")


def enviar_email_cadastro_recebido(destinatario: str, nome: str, motivo: str) -> None:
    """Cadastro pendente de revisão manual (inclusive tentativa com CPF já cadastrado,
    que recebe a mesma mensagem para não revelar que o CPF está na Rede)."""
    corpo = (
        f"Olá, {nome}!\n\n"
        "Recebemos seu cadastro na Rede ATPS.\n\n"
        f"{motivo}\n\n"
        "Por isso, seu cadastro está pendente de verificação e será analisado por um "
        "administrador. Você receberá um novo e-mail com o resultado."
    )
    _enviar_email(destinatario, "Cadastro recebido — Rede ATPS", corpo, "cadastro_recebido")


def enviar_email_alerta_cpf_em_uso(destinatario: str, nome: str) -> None:
    """Avisa o titular de uma conta que alguém tentou criar outra conta com o mesmo CPF."""
    link = f"{settings.frontend_url}/esqueci-senha"
    corpo = (
        f"Olá, {nome}!\n\n"
        "Alguém tentou criar uma nova conta na Rede ATPS usando o CPF vinculado à sua conta. "
        "A nova conta não foi criada e a tentativa foi encaminhada para análise de um administrador.\n\n"
        "Se foi você e perdeu o acesso, redefina sua senha:\n\n"
        f"{link}\n\n"
        "Se não foi você, nenhuma ação é necessária — sua conta continua protegida. "
        "Um administrador poderá entrar em contato."
    )
    _enviar_email(destinatario, "Tentativa de cadastro com seu CPF — Rede ATPS", corpo,
                  "alerta_cpf_em_uso", essencial=True)


def enviar_email_conta_ativada(destinatario: str, nome: str) -> None:
    """Conta ativada manualmente por um administrador."""
    link = f"{settings.frontend_url}/login"
    corpo = (
        f"Olá, {nome}!\n\n"
        "Sua conta na Rede ATPS foi aprovada por um administrador e agora está ativa.\n\n"
        "Você já pode acessar a plataforma:\n\n"
        f"{link}\n\n"
        "Bem-vindo(a) à Rede ATPS!"
    )
    _enviar_email(destinatario, "Sua conta na Rede ATPS foi ativada", corpo, "conta_ativada", essencial=True)


def enviar_email_vinculo_suspenso(destinatario: str, nome: str, prazo_dias: int, exclusao_em: str) -> None:
    """Reverificação periódica não confirmou o vínculo: perfil oculto, prazo para contestar."""
    corpo = (
        f"Olá, {nome}!\n\n"
        "Na verificação periódica da Rede ATPS, não conseguimos confirmar seu vínculo como "
        "Analista Técnico(a) de Políticas Sociais junto ao Portal da Transparência.\n\n"
        "Por isso, seu perfil foi ocultado dos demais usuários. "
        f"Se você continua na carreira (ou é aposentado(a) dela), responda a este e-mail em até "
        f"{prazo_dias} dias para contestar — se possível, com um comprovante de vínculo.\n\n"
        f"Sem contestação, sua conta e seus dados serão excluídos em {exclusao_em}."
    )
    _enviar_email(destinatario, "Vínculo não confirmado — Rede ATPS", corpo, "vinculo_suspenso", essencial=True)


def enviar_email_conta_excluida_vinculo(destinatario: str, nome: str) -> None:
    corpo = (
        f"Olá, {nome}!\n\n"
        "Como seu vínculo com a carreira de ATPS não foi confirmado no prazo informado, "
        "sua conta na Rede ATPS e os dados associados a ela foram excluídos.\n\n"
        "Se isso foi um engano, você pode se cadastrar novamente."
    )
    _enviar_email(destinatario, "Conta excluída — Rede ATPS", corpo, "conta_excluida", essencial=True)


def enviar_email_termos_atualizados(destinatario: str, nome: str) -> None:
    link = f"{settings.frontend_url}/login"
    corpo = (
        f"Olá, {nome}!\n\n"
        "Atualizamos o Termo de Consentimento e/ou a Autorização de consulta do CPF da Rede ATPS.\n\n"
        "No seu próximo acesso, você verá a nova versão e precisará aceitá-la para continuar "
        "usando a Rede. Se preferir não aceitar, você pode excluir sua conta na mesma tela.\n\n"
        f"{link}"
    )
    _enviar_email(destinatario, "Atualização dos termos — Rede ATPS", corpo, "termos_atualizados")
