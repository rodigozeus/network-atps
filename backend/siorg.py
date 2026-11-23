"""Cópia local da estrutura organizacional oficial (SIORG) dos órgãos do Executivo federal.

Fonte pública, sem chave: https://estruturaorganizacional.dados.gov.br
Usada nas listas encadeadas de lotação (nomes e siglas oficiais) e no preenchimento
automático da lotação (lotacao_auto.py).

    python siorg.py              # sincroniza a estrutura agora (também roda de madrugada)
    python siorg.py --detalhes   # busca competência/contato das unidades sem cache ou vencidas
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


# Competência, contato e endereço das unidades: buscados de madrugada (tarefas.py) para TODAS as
# unidades com página (até CAMPOS_ATE) e guardados em unidades_siorg_detalhe. A página da unidade
# só lê esse cache — nunca espera o SIORG, que às vezes demora ou fica fora do ar.
DETALHE_VALIDADE_DIAS = 30
DETALHE_TIMEOUT_S = 15
DETALHE_PAUSA_S = 0.3
DETALHE_TEMPO_MAXIMO_S = 3 * 3600  # por noite; o que faltar continua na noite seguinte
DETALHE_FALHAS_SEGUIDAS = 10  # SIORG fora do ar: para e tenta de novo amanhã


def _endereco(lista) -> str | None:
    e = (lista or [{}])[0] or {}
    cep = str(e.get("cep") or "")
    partes = [
        ", ".join(str(x) for x in (e.get("logradouro"), e.get("numero")) if x),
        e.get("complemento"), e.get("bairro"),
        f"CEP {cep[:5]}-{cep[5:]}" if len(cep) == 8 else None, e.get("uf"),
    ]
    texto = " · ".join(str(p).strip() for p in partes if p and str(p).strip())
    return texto or None


def detalhe(db: Session, unidade_id: int):
    """Competência, contato e endereço da unidade, do cache (None se ainda não buscado)."""
    from models import UnidadeSiorgDetalhe
    return db.get(UnidadeSiorgDetalhe, unidade_id)


def _baixar_detalhe(unidade_id: int) -> dict:
    r = requests.get(f"{BASE}/unidade-organizacional/{unidade_id}/completa",
                     headers={"Accept": "application/json"}, timeout=DETALHE_TIMEOUT_S)
    r.raise_for_status()
    dados = r.json()
    return (dados.get("unidade") or (dados.get("unidades") or [None])[0]) or {}


def atualizar_detalhes(db: Session, agora=None, tempo_maximo_s: float = DETALHE_TEMPO_MAXIMO_S) -> dict:
    """Busca o detalhe das unidades sem cache (primeiro) e das com cache vencido (das mais antigas
    para as mais novas). Um cache vencido continua valendo até a nova busca dar certo."""
    import json
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select
    from models import UnidadeSiorgDetalhe

    agora = agora or datetime.now(timezone.utc)
    limite = agora - timedelta(days=DETALHE_VALIDADE_DIAS)
    ids = db.scalars(select(UnidadeSiorg.id).where(UnidadeSiorg.profundidade <= CAMPOS_ATE)).all()
    caches = {c.id: c for c in db.scalars(select(UnidadeSiorgDetalhe))}

    def quando(c):
        return c.atualizado_em if c.atualizado_em.tzinfo else c.atualizado_em.replace(tzinfo=timezone.utc)

    sem_cache = [i for i in ids if i not in caches]
    vencidas = sorted((i for i in ids if i in caches and quando(caches[i]) < limite), key=lambda i: quando(caches[i]))
    fila = sem_cache + vencidas

    inicio = time.monotonic()
    contagem = {"atualizadas": 0, "falhas": 0, "pendentes": len(fila)}
    seguidas = 0
    for unidade_id in fila:
        if time.monotonic() - inicio > tempo_maximo_s:
            break
        try:
            u = _baixar_detalhe(unidade_id)
        except (requests.RequestException, ValueError):
            contagem["falhas"] += 1
            seguidas += 1
            if seguidas >= DETALHE_FALHAS_SEGUIDAS:
                logger.warning("SIORG: %d falhas seguidas no detalhe das unidades; para até amanhã", seguidas)
                break
            continue
        seguidas = 0
        contato = (u.get("contato") or [{}])[0] or {}
        cache = caches.get(unidade_id)
        if cache is None:
            cache = UnidadeSiorgDetalhe(id=unidade_id)
            db.add(cache)
        cache.competencia = (u.get("competencia") or u.get("finalidade") or "").strip() or None
        cache.contato = json.dumps({
            "telefones": [t for t in contato.get("telefone") or [] if t],
            "emails": [e for e in contato.get("email") or [] if e],
            "sites": [x for x in contato.get("site") or [] if x],
        }, ensure_ascii=False)
        cache.endereco = _endereco(u.get("endereco"))
        cache.atualizado_em = datetime.now(timezone.utc)
        db.commit()
        contagem["atualizadas"] += 1
        time.sleep(DETALHE_PAUSA_S)
    contagem["pendentes"] -= contagem["atualizadas"]
    return contagem


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    from database import SessionLocal
    with SessionLocal() as sessao:
        if "--detalhes" in sys.argv:
            print(atualizar_detalhes(sessao))
        else:
            print(f"{sincronizar(sessao)} unidades sincronizadas")
