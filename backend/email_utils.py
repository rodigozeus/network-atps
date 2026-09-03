import logging
import smtplib
from email.mime.text import MIMEText

from database import settings

logger = logging.getLogger(__name__)


def _enviar_email(destinatario: str, assunto: str, corpo: str) -> None:
    if not settings.smtp_host:
        logger.warning(
            "SMTP não configurado — e-mail '%s' para %s não enviado:\n%s",
            assunto, destinatario, corpo,
        )
        return

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
    except Exception:
        logger.exception("Falha ao enviar e-mail '%s' para %s", assunto, destinatario)


def enviar_email_redefinicao_senha(destinatario: str, nome: str, token: str) -> None:
    link = f"{settings.frontend_url}/redefinir-senha?token={token}"
    corpo = (
        f"Olá, {nome}!\n\n"
        "Recebemos uma solicitação para redefinir sua senha na Rede ATPS.\n"
        "Clique no link abaixo para escolher uma nova senha (válido por 1 hora):\n\n"
        f"{link}\n\n"
        "Se você não solicitou essa redefinição, pode ignorar este e-mail."
    )
    _enviar_email(destinatario, "Redefinição de senha — Rede ATPS", corpo)


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
    _enviar_email(destinatario, "Bem-vindo(a) à Rede ATPS", corpo)


def enviar_email_cadastro_recebido(destinatario: str, nome: str) -> None:
    """Cadastro criado inativo, pendente de revisão manual."""
    corpo = (
        f"Olá, {nome}!\n\n"
        "Recebemos seu cadastro na Rede ATPS.\n\n"
        "Não conseguimos confirmar automaticamente seu vínculo como ATPS junto ao "
        "Portal da Transparência do Governo Federal, então sua conta está "
        "pendente de verificação e precisará ser aprovada por um administrador.\n\n"
        "Você receberá um novo e-mail assim que sua conta for ativada."
    )
    _enviar_email(destinatario, "Cadastro recebido — Rede ATPS", corpo)


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
    _enviar_email(destinatario, "Sua conta na Rede ATPS foi ativada", corpo)
