import logging
import unicodedata

import requests

from database import settings

logger = logging.getLogger(__name__)

API_URL = "https://api.portaldatransparencia.gov.br/api-de-dados/servidores"
TIMEOUT_SEGUNDOS = 6
CARGO_ATPS_PALAVRA_CHAVE = "POLITICAS SOCIAIS"


def _normalizar(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    return sem_acento.upper()


def _registro_indica_atps(registro: dict) -> bool:
    """Procura a palavra-chave do cargo em qualquer campo do registro retornado
    pela API. Evita depender do nome exato do campo de cargo no DTO, que não é
    garantido entre versões da API."""
    valores: list[str] = []

    def _coletar(valor):
        if isinstance(valor, dict):
            for v in valor.values():
                _coletar(v)
        elif isinstance(valor, list):
            for v in valor:
                _coletar(v)
        elif isinstance(valor, str):
            valores.append(valor)

    _coletar(registro)
    texto = _normalizar(" ".join(valores))
    return CARGO_ATPS_PALAVRA_CHAVE in texto


def consultar_situacao_atps(cpf_limpo: str) -> bool | None:
    """Consulta o Portal da Transparência para confirmar se o CPF pertence a um(a)
    Analista Técnico(a) em Políticas Sociais (ATPS) do Poder Executivo Federal.

    Essa é a única forma de verificação automática do vínculo — não há mais uma
    lista local (CSV) como alternativa. Qualquer retorno diferente de True deixa
    o cadastro pendente de aprovação manual.

    Retorna:
        True  — CPF encontrado com cargo de ATPS.
        False — API respondeu, mas não encontrou vínculo de ATPS para o CPF.
        None  — consulta inconclusiva (API não configurada ou indisponível).
    """
    if not settings.portal_transparencia_token:
        logger.warning("PORTAL_TRANSPARENCIA_TOKEN não configurado — pulando verificação por CPF")
        return None

    try:
        resposta = requests.get(
            API_URL,
            params={"cpf": cpf_limpo, "pagina": 1},
            headers={"chave-api-dados": settings.portal_transparencia_token},
            timeout=TIMEOUT_SEGUNDOS,
        )
        resposta.raise_for_status()
    except requests.RequestException:
        logger.exception("Falha ao consultar o Portal da Transparência")
        return None

    try:
        registros = resposta.json()
    except ValueError:
        logger.error("Resposta não-JSON do Portal da Transparência")
        return None

    if isinstance(registros, dict):
        registros = registros.get("items") or registros.get("data") or []
    if not isinstance(registros, list):
        return None

    return any(_registro_indica_atps(r) for r in registros if isinstance(r, dict))
