"""Cópia local da estrutura organizacional oficial (SIORG) dos órgãos do Executivo federal.

Fonte pública, sem chave: https://estruturaorganizacional.dados.gov.br
Usada nas listas encadeadas de lotação (nomes e siglas oficiais) e no preenchimento
automático da lotação (lotacao_auto.py).

    python siorg.py              # sincroniza a estrutura agora (também roda de madrugada)
    python siorg.py --detalhes [--forcar]  # importa competência/contato do arquivo mensal
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


# Competência, contato e endereço das unidades vêm do arquivo mensal que o governo publica com a
# estrutura completa (repositorio.dados.gov.br): um download por mês em vez de uma consulta por
# unidade à API, que às vezes fica dias fora do ar. Importado de madrugada (tarefas.py) para TODAS
# as unidades com página (até CAMPOS_ATE); a página da unidade só lê o cache.
REPOSITORIO = "https://repositorio.dados.gov.br/seges/siorg/estrutura-organizacional-completa/"
ARQUIVO_TIMEOUT_S = 120
VAZIOS = {"", ".", "-", "..."}


def _endereco(linha: dict) -> str | None:
    cep = "".join(c for c in (linha.get("cep") or "") if c.isdigit())
    partes = [linha.get("linhaEndereco"), linha.get("bairro"),
              f"CEP {cep[:5]}-{cep[5:]}" if len(cep) == 8 else None, linha.get("uf")]
    texto = " · ".join(_limpar(p).strip() for p in partes if p and p.strip())
    return texto or None


def _telefone(bruto: str) -> str:
    """'(55) (61) 20273622' -> '(61) 2027-3622'. Outros formatos ficam como vieram."""
    import re
    m = re.fullmatch(r"\(55\)\s*\((\d{2})\)\s*(\d{4,5})(\d{4})", bruto.strip())
    return f"({m[1]}) {m[2]}-{m[3]}" if m else bruto.strip()


def _lista(bruto: str | None) -> list[str]:
    import re
    return [x.strip() for x in re.split(r"[;,]", _limpar(bruto or "")) if x.strip() and x.strip() not in VAZIOS]


def _limpar(texto: str) -> str:
    """Conserta o que o arquivo do SIORG traz estragado: aspas e travessões que viraram "¿"
    na conversão do sistema de origem ("CAPÍTULO II ¿ DOS FLUXOS", "¿b¿"), aspas e travessão
    em códigos de controle do Windows e espaços/hífens invisíveis."""
    import re
    t = texto.replace("\u00a0", " ").replace("\u00ad", "")
    t = t.replace("\u0093", "\u201c").replace("\u0094", "\u201d").replace("\u0096", "\u2013").replace("\u0097", "\u2014")
    t = re.sub(r"\s\u00bf\s", " \u2013 ", t)  # "II ¿ DOS" -> "II – DOS"
    t = re.sub(r"(?<=\w)¿(?=\w)", "-", t)  # "Coordenação¿Geral" -> "Coordenação-Geral"
    t = re.sub(r"(^|[\s(\[])\u00bf(?=\S)", "\\1\u201c", t)  # abre aspas: " ¿de" -> " “de"
    t = re.sub(r"(?<=\S)\u00bf", "\u201d", t)  # fecha aspas: "cio¿," -> "cio”,"
    return t.replace("\u00bf", "\u2013")


def _texto(bruto: str | None) -> str | None:
    t = _limpar(bruto or "").strip()
    return None if t in VAZIOS else t


def detalhe(db: Session, unidade_id: int):
    """Competência, contato e endereço da unidade, do cache (None se ainda não importado)."""
    from models import UnidadeSiorgDetalhe
    return db.get(UnidadeSiorgDetalhe, unidade_id)


def arquivo_mais_recente():
    """(AAAA-MM, url, quando foi publicado) do arquivo mensal mais recente no repositório.
    A data de publicação vem da listagem (pode ser bem depois do mês do nome do arquivo)."""
    import re
    from datetime import datetime, timezone
    r = requests.get(REPOSITORIO, timeout=30)
    r.raise_for_status()
    achados = re.findall(
        r'href="estrutura-organizacional-completa-(\d{4}-\d{2})\.zip">[^<]*</a>\s+(\d{2}-\w{3}-\d{4} \d{2}:\d{2})', r.text)
    if not achados:
        raise RuntimeError("SIORG: nenhum arquivo mensal no repositório")
    mes, quando = max(achados)
    publicado = datetime.strptime(quando, "%d-%b-%Y %H:%M").replace(tzinfo=timezone.utc)
    return mes, f"{REPOSITORIO}estrutura-organizacional-completa-{mes}.zip", publicado


def importar_detalhes(db: Session, agora=None, forcar: bool = False) -> dict:
    """Baixa o arquivo mensal mais recente e grava o detalhe de todas as unidades com página.
    Não baixa de novo se todas já foram importadas depois da publicação do arquivo."""
    import csv
    import io
    import json
    import tempfile
    import zipfile
    from datetime import datetime, timezone
    from sqlalchemy import func, select
    from lotacao_auto import normalizar  # aqui dentro: lotacao_auto importa deste módulo
    from models import UnidadeSiorgDetalhe

    agora = agora or datetime.now(timezone.utc)
    mes, url, publicado = arquivo_mais_recente()
    ids = set(db.scalars(select(UnidadeSiorg.id).where(UnidadeSiorg.profundidade <= CAMPOS_ATE)))
    caches = {c.id: c for c in db.scalars(select(UnidadeSiorgDetalhe))}

    def quando(c):
        return c.atualizado_em if c.atualizado_em.tzinfo else c.atualizado_em.replace(tzinfo=timezone.utc)

    if not forcar and ids and all(i in caches and quando(caches[i]) >= publicado for i in ids):
        return {"arquivo": mes, "atualizadas": 0, "situacao": "já importado"}

    with tempfile.TemporaryFile() as tmp:
        with requests.get(url, stream=True, timeout=ARQUIVO_TIMEOUT_S) as r:
            r.raise_for_status()
            for bloco in r.iter_content(1 << 20):
                tmp.write(bloco)
        tmp.seek(0)
        with zipfile.ZipFile(tmp) as z:
            nome = next(n for n in z.namelist() if n.endswith(".csv"))
            with z.open(nome) as f:
                encontradas = 0
                for linha in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", errors="replace")):
                    unidade_id = _id(linha.get("codigoUnidade"))
                    if unidade_id not in ids:
                        continue
                    cache = caches.get(unidade_id)
                    if cache is None:
                        cache = caches[unidade_id] = UnidadeSiorgDetalhe(id=unidade_id)
                        db.add(cache)
                    cache.competencia = _texto(linha.get("competencia")) or _texto(linha.get("finalidade"))
                    cache.competencia_busca = f" {normalizar(cache.competencia)} " if cache.competencia else None
                    cache.contato = json.dumps({
                        "telefones": [_telefone(t) for t in _lista(linha.get("telefone"))],
                        "emails": _lista(linha.get("email")),
                        "sites": _lista(linha.get("site")),
                    }, ensure_ascii=False)
                    cache.endereco = _endereco(linha)
                    cache.atualizado_em = agora
                    encontradas += 1
                    if encontradas % 2000 == 0:
                        db.commit()

    # unidades criadas depois do arquivo: ficam sem detalhe, mas marcadas, para não baixar de novo
    # toda noite; entram no próximo arquivo mensal
    ausentes = 0
    for unidade_id in ids:
        cache = caches.get(unidade_id)
        if cache is None:
            db.add(UnidadeSiorgDetalhe(id=unidade_id, atualizado_em=agora))
            ausentes += 1
        elif quando(cache) < agora and quando(cache) < publicado:
            cache.atualizado_em = agora
    db.commit()
    total = db.scalar(select(func.count()).select_from(UnidadeSiorgDetalhe).where(UnidadeSiorgDetalhe.competencia.isnot(None)))
    return {"arquivo": mes, "atualizadas": encontradas, "fora_do_arquivo": ausentes, "com_competencia": total}


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    from database import SessionLocal
    with SessionLocal() as sessao:
        if "--detalhes" in sys.argv:
            print(importar_detalhes(sessao, forcar="--forcar" in sys.argv))
        else:
            print(f"{sincronizar(sessao)} unidades sincronizadas")
