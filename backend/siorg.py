"""Cópia local da estrutura organizacional oficial (SIORG) dos órgãos do Executivo federal.

Fonte pública, sem chave: https://estruturaorganizacional.dados.gov.br
Usada nas listas encadeadas de lotação (nomes e siglas oficiais) e no preenchimento
automático da lotação (lotacao_auto.py).

    python siorg.py   # sincroniza agora (também roda na tarefa diária)
"""
import logging
import time

import requests
from sqlalchemy import delete
from sqlalchemy.orm import Session

from models import UnidadeSiorg

logger = logging.getLogger(__name__)

BASE = "https://estruturaorganizacional.dados.gov.br/doc"
PARAMS = {"codigoPoder": 1, "codigoEsfera": 1}  # Executivo, federal
TIMEOUT_S = 60
PAUSA_S = 0.5
# Até divisões e serviços: servem para casar a unidade de exercício do SIAPE. As listas
# e os campos do perfil vão só até a coordenação (CAMPOS_ATE).
PROFUNDIDADE_MAXIMA = 6
CAMPOS_ATE = 4


def _id(url: str | None) -> int | None:
    try:
        return int((url or "").rstrip("/").rsplit("/", 1)[-1])
    except ValueError:
        return None


def _tipo(u: dict) -> str:
    return (u.get("codigoTipoUnidade") or "").rsplit("/", 1)[-1]


def _get(caminho: str, **extra) -> list[dict]:
    r = requests.get(f"{BASE}/{caminho}", params={**PARAMS, **extra},
                     headers={"Accept": "application/json"}, timeout=TIMEOUT_S)
    r.raise_for_status()
    dados = r.json()
    if (dados.get("servico") or {}).get("codigoErro") not in (0, None):
        raise RuntimeError(f"SIORG: {dados['servico'].get('mensagem')}")
    return dados.get("unidades") or []


def baixar() -> list[UnidadeSiorg]:
    """Órgãos da administração direta (ministérios, Presidência, CGU, AGU...) e suas
    unidades administrativas até a profundidade máxima."""
    linhas: list[UnidadeSiorg] = []
    orgaos = [u for u in _get("orgao-entidade/resumida") if _tipo(u) == "orgao"]
    for orgao in orgaos:
        raiz = _id(orgao["codigoUnidade"])
        unidades = _get("estrutura-organizacional/resumida", codigoUnidade=raiz)
        time.sleep(PAUSA_S)
        por_id = {_id(u["codigoUnidade"]): u for u in unidades if _tipo(u) == "unidade-administrativa"}

        profundidade: dict[int, int] = {raiz: 0}

        def prof(i: int, visitados=()) -> int | None:
            if i in profundidade:
                return profundidade[i]
            u = por_id.get(i)
            pai = _id(u["codigoUnidadePai"]) if u else None
            if u is None or pai is None or i in visitados:
                return None
            p = prof(pai, visitados + (i,))
            profundidade[i] = None if p is None else p + 1
            return profundidade[i]

        linhas.append(UnidadeSiorg(id=raiz, pai_id=None, orgao_id=raiz, nome=orgao["nome"].strip(),
                                   sigla=(orgao.get("sigla") or "").strip() or None, profundidade=0))
        for i, u in por_id.items():
            p = prof(i)
            if i == raiz or p is None or p > PROFUNDIDADE_MAXIMA:
                continue
            linhas.append(UnidadeSiorg(
                id=i, pai_id=_id(u["codigoUnidadePai"]), orgao_id=raiz, nome=u["nome"].strip()[:400],
                sigla=(u.get("sigla") or "").strip()[:60] or None, profundidade=p,
            ))
    return linhas


def sincronizar(db: Session) -> int:
    """Substitui a cópia local inteira. Se o download falhar, a cópia anterior fica."""
    linhas = baixar()
    if not linhas:
        raise RuntimeError("SIORG devolveu estrutura vazia; cópia local mantida")
    db.execute(delete(UnidadeSiorg))
    db.add_all(linhas)
    db.commit()
    return len(linhas)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    from database import SessionLocal
    with SessionLocal() as sessao:
        print(f"{sincronizar(sessao)} unidades sincronizadas")
