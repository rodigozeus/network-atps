import logging
import smtplib
from email.mime.text import MIMEText

from database import settings

logger = logging.getLogger(__name__)


def enviar_email_redefinicao_senha(destinatario: str, nome: str, token: str) -> None:
    link = f"{settings.frontend_url}/redefinir-senha?token={token}"

    if not settings.smtp_host:
        logger.warning(
            "SMTP não configurado — link de redefinição de senha para %s: %s",
            destinatario, link,
        )
        return

    corpo = (
        f"Olá, {nome}!\n\n"
        "Recebemos uma solicitação para redefinir sua senha na Rede ATPS.\n"
        f"Clique no link abaixo para escolher uma nova senha (válido por 1 hora):\n\n"
        f"{link}\n\n"
        "Se você não solicitou essa redefinição, pode ignorar este e-mail."
    )
    msg = MIMEText(corpo, "plain", "utf-8")
    msg["Subject"] = "Redefinição de senha — Rede ATPS"
    msg["From"] = settings.smtp_from or settings.smtp_user or "no-reply@redeatps.org"
    msg["To"] = destinatario

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password or "")
            server.sendmail(msg["From"], [destinatario], msg.as_string())
    except Exception:
        logger.exception("Falha ao enviar e-mail de redefinição de senha para %s", destinatario)
