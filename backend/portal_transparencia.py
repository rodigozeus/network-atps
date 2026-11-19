import enum
import logging
import re
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
class Exercicio:
    """Onde e como a pessoa está em exercício, segundo o SIAPE. Usado só para preencher
    campos em branco do perfil e sugerir atualizações (lotacao_auto.py, atualizacao.py),
    conforme a versão da Autorização de consulta do CPF aceita."""
    orgao_sigla: str | None
    orgao_nome: str | None
    unidade: str | None  # nome da UORG, abreviado e truncado pelo SIAPE
    funcao: str | None = None  # já formatada: "Coordenador(a) · FCE 1.10"
    ano_ingresso_servico_publico: int | None = None
    orgao_siorg_id: int | None = None  # quando já conhecido (base local)
    fonte: str = "api"  # api | base_local


@dataclass
class ResultadoVerificacao:
    status: StatusVerificacao
    exercicio: Exercicio | None = None

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


# --- Função comissionada ---

SIGLAS_FUNCAO = {"FEX": "FCE", "CCX": "CCE"}
ACENTOS = {
    "DIVISAO": "Divisão", "TECNICO": "Técnico", "TECNICA": "Técnica", "SERVICO": "Serviço",
    "COORDENACAO": "Coordenação", "SECRETARIO": "Secretário", "SECRETARIA": "Secretária",
    "ESPECIFICO": "Específico", "ESPECIFICA": "Específica", "ANALISE": "Análise",
}
MINUSCULAS = {"de", "da", "do", "das", "dos", "e", "em", "a", "o"}
ROMANOS = {"I", "II", "III", "IV", "V", "VI"}


def _capitalizar(texto: str) -> str:
    """"CHEFE DE PROJETO/ATIVIDADE II" -> "Chefe de Projeto/Atividade II";
    "COORDENADOR(A) GERAL" -> "Coordenador(a)-Geral" """
    def palavra(m: re.Match) -> str:
        w = m.group(0)
        if w.upper() in ROMANOS and m.start() > 0:
            return w.upper()
        if w.upper() in ACENTOS:
            return ACENTOS[w.upper()]
        baixa = w.lower()
        return baixa if m.start() > 0 and baixa in MINUSCULAS else baixa.capitalize()

    texto = re.sub(r"[A-Za-zÀ-ÿ]+", palavra, " ".join(texto.split()))
    return re.sub(r"\b(Coordenador(?:\(a\)|a)?) Geral\b", r"\1-Geral", texto)


def formatar_funcao(sigla: str | None, nivel: str | None, atividade: str | None) -> str | None:
    """("FEX", "0110", "COORDENADOR(A)") -> "Coordenador(a) · FCE 1.10" """
    sigla = (sigla or "").strip().upper()
    digitos = re.sub(r"\D", "", nivel or "")
    atividade = (atividade or "").strip()
    if not sigla or sigla == "-1" or len(digitos) != 4 or not atividade or "INFORMA" in _normalizar(atividade):
        return None
    codigo = f"{SIGLAS_FUNCAO.get(sigla, sigla)} {int(digitos[:2])}.{digitos[2:]}"
    return f"{_capitalizar(atividade)} · {codigo}"


def _funcao_da_api(registros: list[dict]) -> str | None:
    funcoes = set()
    for r in registros:
        for f in r.get("fichasFuncao") or []:
            if not isinstance(f, dict):
                continue
            partes = str(f.get("funcao") or "").split()
            if len(partes) >= 2:
                fmt = formatar_funcao(partes[0], partes[1], f.get("atividade"))
                if fmt:
                    funcoes.add(fmt)
    return next(iter(funcoes)) if len(funcoes) == 1 else None  # mais de uma: não dá para escolher


def _ano(data) -> int | None:
    m = re.search(r"(\d{4})", str(data or ""))
    return int(m.group(1)) if m else None


# --- Registro da API ---

def _registro_e_atps(registro: dict) -> bool:
    for chave in FICHAS_VALIDAS:
        for ficha in registro.get(chave) or []:
            if isinstance(ficha, dict) and CARGO_ATPS_PALAVRA_CHAVE in _normalizar(str(ficha.get("cargo", ""))):
                return True
    return False


def _texto(valor) -> str | None:
    v = str(valor or "").strip()
    return None if not v or v.lower() == "sem informação" else v


def _ficha_atps(registro: dict) -> dict | None:
    return next(
        (f for f in registro.get("fichasCargoEfetivo") or []
         if isinstance(f, dict) and CARGO_ATPS_PALAVRA_CHAVE in _normalizar(str(f.get("cargo", "")))),
        None,
    )


def _exercicio(registro: dict) -> Exercicio | None:
    orgao = (registro.get("servidor") or {}).get("orgaoServidorExercicio") or {}
    ficha = _ficha_atps(registro) or {}
    ex = Exercicio(
        _texto(orgao.get("sigla")), _texto(orgao.get("nome")), _texto(ficha.get("uorgExercicio")),
        ano_ingresso_servico_publico=_ano(ficha.get("dataIngressoServicoPublico")),
    )
    return ex if ex.orgao_sigla else None


def _nome_oficial(registro: dict) -> str:
    servidor = registro.get("servidor") or {}
    return str((servidor.get("pessoa") or {}).get("nome", ""))


def _consultar_api(cpf_limpo: str) -> list | None:
    """Registros da API, ou None se ela não respondeu direito."""
    if not settings.portal_transparencia_token:
        logger.warning("PORTAL_TRANSPARENCIA_TOKEN não configurado — sem consulta à API do Portal")
        return None
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
        return None
    if resposta.status_code != 200:
        logger.error("Portal da Transparência respondeu HTTP %s", resposta.status_code)
        return None
    try:
        registros = resposta.json()
    except ValueError:
        logger.error("Resposta não-JSON do Portal da Transparência")
        return None
    return registros if isinstance(registros, list) else None


def consultar_situacao_atps(cpf_limpo: str, nome_informado: str | None) -> ResultadoVerificacao:
    """Confirma se o CPF pertence a um(a) Analista Técnico(a) de Políticas Sociais (ATPS),
    ativo(a) ou aposentado(a), e se o nome informado confere com o registro
    (`nome_informado=None` pula essa checagem — usado na reverificação periódica, já que o
    nome pode mudar legitimamente).

    Fonte: a API do Portal da Transparência. Se ela não responder e houver nome para
    conferir, usa a cópia local dos dados abertos do Portal (base_local.py), que só
    confirma — nunca nega, porque é mensal e não inclui aposentados.

    Os logs nunca incluem o CPF nem a URL da consulta (que o contém). Qualquer resultado
    diferente de `confirmado` deixa o cadastro pendente de aprovação manual.
    """
    registros = _consultar_api(cpf_limpo)
    if registros is None:
        if nome_informado is not None:
            import base_local
            local = base_local.consultar(cpf_limpo, nome_informado)
            if local is not None:
                logger.info("Vínculo confirmado pela cópia local da base do Portal (API indisponível)")
                return local
        return ResultadoVerificacao(StatusVerificacao.inconclusivo)

    registros_atps = [r for r in registros if isinstance(r, dict) and _registro_e_atps(r)]
    if not registros_atps:
        return ResultadoVerificacao(StatusVerificacao.nao_encontrado)

    if nome_informado is not None:
        registros_atps = [r for r in registros_atps if nomes_conferem(nome_informado, _nome_oficial(r))]
        if not registros_atps:
            return ResultadoVerificacao(StatusVerificacao.nome_divergente)

    # Mais de um vínculo ATPS ativo com exercícios diferentes: não dá para escolher
    exercicios = {(e.orgao_sigla, e.unidade): e for e in map(_exercicio, registros_atps) if e}
    exercicio = next(iter(exercicios.values())) if len(exercicios) == 1 else None
    if exercicio is not None:
        # a ficha de função vem repetida em todos os registros da mesma pessoa
        exercicio.funcao = _funcao_da_api(registros)
    return ResultadoVerificacao(StatusVerificacao.confirmado, exercicio)
