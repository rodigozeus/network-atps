from fastapi import HTTPException, Request, status

from documentos_legais import OBRIGATORIOS, documento_atual
from models import AcaoConsentimento, Analista, Consentimento

# Autorizações de exibição (sem documento associado), uma por campo opcional.
EXIBIR_PERFIL = "exibir_perfil"
EXIBIR_EMAIL_PESSOAL = "exibir_email_pessoal"
EXIBIR_CELULAR = "exibir_celular"


def ip_cliente(request: Request | None) -> str | None:
    if request is None:
        return None
    # O nginx repassa o IP real do visitante (vindo do Cloudflare) neste cabeçalho.
    return request.headers.get("x-real-ip") or (request.client.host if request.client else None)


def registrar(
    analista: Analista,
    tipo: str,
    acao: AcaoConsentimento,
    request: Request | None = None,
    com_documento: bool = False,
) -> None:
    doc = documento_atual(tipo) if com_documento else None
    analista.consentimentos.append(Consentimento(
        tipo=tipo,
        acao=acao,
        documento_versao=doc.versao if doc else None,
        documento_hash=doc.hash if doc else None,
        ip=ip_cliente(request),
        user_agent=(request.headers.get("user-agent") or "")[:300] if request else None,
    ))


def validar_versoes(versoes: dict[str, int]) -> None:
    """Garante que o usuário aceitou exatamente as versões vigentes (e não uma
    versão que estava na tela antes de uma atualização)."""
    for tipo in OBRIGATORIOS:
        if versoes.get(tipo) != documento_atual(tipo).versao:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Os termos foram atualizados. Recarregue a página e leia a nova versão.",
            )


def registrar_aceite_obrigatorios(analista: Analista, request: Request) -> None:
    for tipo in OBRIGATORIOS:
        registrar(analista, tipo, AcaoConsentimento.aceito, request, com_documento=True)
