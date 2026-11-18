import enum
import logging
import unicodedata
from dataclasses import dataclass

import requests

from database import settings

logger = logging.getLogger(__name__)

API_URL = "https://api.portaldatransparencia.gov.br/api-de-dados/servidores"
TIMEOUT_SEGUNDOS = 6
CARGO_ATPS_PALAVRA_CHAVE = "POLITICAS SOCIAIS"

# Fichas do registro em que o cargo indica vínculo válido com a carreira.
# Aposentados da carreira são aceitos (decisão da ANDEPS de 28/10/2026).
FICHAS_VALIDAS = ("fichasCargoEfetivo", "fichasAposentadoria")

PARTICULAS_NOME = {"DE", "DA", "DO", "DAS", "DOS", "E"}


class StatusVerificacao(str, enum.Enum):
    confirmado = "confirmado"
    nao_encontrado = "nao_encontrado"
    nome_divergente = "nome_divergente"
    inconclusivo = "inconclusivo"


MOTIVOS = {
    StatusVerificacao.nao_encontrado: (
        "Não encontramos vínculo como ATPS para este CPF no Portal da Transparência."
    ),
    StatusVerificacao.nome_divergente: (
        "O nome informado não confere com o nome registrado no Portal da Transparência para este CPF."
    ),
    StatusVerificacao.inconclusivo: (
        "Não foi possível concluir a verificação automática do seu vínculo como ATPS."
    ),
}


@dataclass
class ResultadoVerificacao:
    status: StatusVerificacao

    @property
    def confirmado(self) -> bool:
        return self.status == StatusVerificacao.confirmado

    @property
    def motivo(self) -> str | None:
        return MOTIVOS.get(self.status)


def _normalizar(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto or "")
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(sem_acento.upper().split())


def _tokens_nome(nome: str) -> list[str]:
    return [t for t in _normalizar(nome).split() if t not in PARTICULAS_NOME]


def nomes_conferem(informado: str, oficial: str) -> bool:
    """Aceita nome abreviado: primeiro e último nomes iguais e todos os nomes
    informados presentes no nome oficial."""
    inf, ofi = _tokens_nome(informado), _tokens_nome(oficial)
    if len(inf) < 2 or not ofi:
        return False
    return inf[0] == ofi[0] and inf[-1] == ofi[-1] and set(inf) <= set(ofi)


def _registro_e_atps(registro: dict) -> bool:
    for chave in FICHAS_VALIDAS:
        for ficha in registro.get(chave) or []:
            if isinstance(ficha, dict) and CARGO_ATPS_PALAVRA_CHAVE in _normalizar(str(ficha.get("cargo", ""))):
                return True
    return False


def _nome_oficial(registro: dict) -> str:
    servidor = registro.get("servidor") or {}
    return str((servidor.get("pessoa") or {}).get("nome", ""))


def consultar_situacao_atps(cpf_limpo: str, nome_informado: str | None) -> ResultadoVerificacao:
    """Consulta o Portal da Transparência para confirmar se o CPF pertence a um(a)
    Analista Técnico(a) de Políticas Sociais (ATPS), ativo(a) ou aposentado(a), e se o
    nome informado confere com o registro (`nome_informado=None` pula essa checagem —
    usado na reverificação periódica, já que o nome pode mudar legitimamente).

    Nada do registro retornado é armazenado. Os logs nunca incluem o CPF nem a URL da
    consulta (que o contém). Qualquer resultado diferente de `confirmado` deixa o
    cadastro pendente de aprovação manual.
    """
    if not settings.portal_transparencia_token:
        logger.warning("PORTAL_TRANSPARENCIA_TOKEN não configurado — pulando verificação por CPF")
        return ResultadoVerificacao(StatusVerificacao.inconclusivo)

    try:
        resposta = requests.get(
            API_URL,
            params={"cpf": cpf_limpo, "pagina": 1},
            headers={"chave-api-dados": settings.portal_transparencia_token},
            timeout=TIMEOUT_SEGUNDOS,
        )
    except requests.RequestException as exc:
        # Não logar a exceção: a mensagem dela contém a URL com o CPF.
        logger.error("Falha de conexão com o Portal da Transparência (%s)", type(exc).__name__)
        return ResultadoVerificacao(StatusVerificacao.inconclusivo)

    if resposta.status_code != 200:
        logger.error("Portal da Transparência respondeu HTTP %s", resposta.status_code)
        return ResultadoVerificacao(StatusVerificacao.inconclusivo)

    try:
        registros = resposta.json()
    except ValueError:
        logger.error("Resposta não-JSON do Portal da Transparência")
        return ResultadoVerificacao(StatusVerificacao.inconclusivo)

    if not isinstance(registros, list):
        return ResultadoVerificacao(StatusVerificacao.inconclusivo)

    registros_atps = [r for r in registros if isinstance(r, dict) and _registro_e_atps(r)]
    if not registros_atps:
        return ResultadoVerificacao(StatusVerificacao.nao_encontrado)

    if nome_informado is not None and not any(
        nomes_conferem(nome_informado, _nome_oficial(r)) for r in registros_atps
    ):
        return ResultadoVerificacao(StatusVerificacao.nome_divergente)

    return ResultadoVerificacao(StatusVerificacao.confirmado)
