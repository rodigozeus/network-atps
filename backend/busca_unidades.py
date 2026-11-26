"""Busca de unidades (SIORG) junto com a busca de pessoas.

Uma unidade só aparece quando combina bem com o que foi digitado, por um destes motivos
(nesta ordem de força):
  nome         todos os termos no nome ou na sigla da unidade;
  pessoas      alguém lotado ali (perfil visível) tem todos os termos nos temas ou no
               "Em que posso ajudar" — acha quem faz algo que o nome da unidade não diz;
  competencia  todos os termos num mesmo item do texto de competência do SIORG.

"Combina" é sem acento e por palavra: termos de 4 letras ou mais valem pelo começo da palavra
("parceri" acha "Parcerias"); os curtos, só a palavra inteira ("SE" acha a sigla SE, mas não
"Secretaria"). O órgão de quem busca vem primeiro. Tudo sai do banco, sem consulta externa.
"""
import re
import time
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from lotacao_auto import CAMPOS, normalizar
from models import Analista, UnidadeSiorg, UnidadeSiorgDetalhe, condicao_perfil_visivel

PROFUNDIDADE_PAGINA = max(CAMPOS)  # unidades com página própria
LIMITE = 20
TRECHO_MAX = 240
CACHE_S = 600
PREFIXO_MINIMO = 4
VAZIAS = {"A", "AS", "O", "OS", "DE", "DA", "DAS", "DO", "DOS", "E", "EM", "NA", "NAS", "NO", "NOS", "PARA", "COM"}

_cache: dict = {"em": 0.0, "unidades": None}


def _termos(q: str) -> list[str]:
    return [t for t in normalizar(q).split() if t not in VAZIAS][:6]


def _casa_palavra(termo: str, palavra: str) -> bool:
    return palavra.startswith(termo) if len(termo) >= PREFIXO_MINIMO else palavra == termo


def _casa(termos: list[str], palavras: list[str]) -> bool:
    return all(any(_casa_palavra(t, p) for p in palavras) for t in termos)


def _unidades(db: Session) -> dict[int, tuple]:
    """id -> (pai_id, orgao_id, profundidade, nome, sigla, palavras do nome e da sigla).
    Em memória por alguns minutos: a estrutura só muda de madrugada."""
    if _cache["unidades"] is None or time.monotonic() - _cache["em"] > CACHE_S:
        linhas = db.execute(select(
            UnidadeSiorg.id, UnidadeSiorg.pai_id, UnidadeSiorg.orgao_id, UnidadeSiorg.profundidade,
            UnidadeSiorg.nome, UnidadeSiorg.sigla,
        )).all()
        _cache["unidades"] = {
            i: (pai, org, prof, nome, sigla, normalizar(f"{nome} {sigla or ''}").split())
            for i, pai, org, prof, nome, sigla in linhas
        }
        _cache["em"] = time.monotonic()
    return _cache["unidades"]


def _com_pagina(us: dict, unidade_id: int | None) -> int | None:
    """A própria unidade ou a mais próxima acima dela que tem página."""
    while unidade_id in us and us[unidade_id][2] > PROFUNDIDADE_PAGINA:
        unidade_id = us[unidade_id][0]
    return unidade_id if unidade_id in us else None


def _trecho(competencia: str, termos: list[str]) -> str | None:
    """O item da competência ("I - ...", "II - ...") que tem todos os termos."""
    for item in re.split(r"(?:^|\s)(?=[IVXLC]+\s*[-–.)]\s)|;\s*|\n+", competencia):
        item = item.strip(" ;\n")
        if item and _casa(termos, normalizar(item).split()):
            return item if len(item) <= TRECHO_MAX else item[:TRECHO_MAX].rsplit(" ", 1)[0] + "…"
    return None


def buscar(db: Session, q: str, eu: Analista, ministerio: str | None = None, unidade: int | None = None) -> dict:
    termos = _termos(q)
    if not termos:
        return {"total": 0, "itens": []}

    us = _unidades(db)
    orgaos_permitidos = None
    if ministerio and ministerio.strip():
        alvo = normalizar(ministerio)
        orgaos_permitidos = {i for i, u in us.items() if u[2] == 0 and alvo in (normalizar(u[3]), normalizar(u[4] or ""))}

    dentro = subarvore(db, unidade) if unidade in us else None

    def permitida(i: int | None) -> bool:
        u = us.get(i)
        return (u is not None and u[2] <= PROFUNDIDADE_PAGINA and (orgaos_permitidos is None or u[1] in orgaos_permitidos)
                and (dentro is None or i in dentro))

    motivo: dict[int, str] = {}

    # 1) nome ou sigla
    for i, u in us.items():
        if permitida(i) and _casa(termos, u[5]):
            motivo[i] = "nome"

    # 2) pessoas lotadas ali que dizem fazer isso (temas ou "Em que posso ajudar")
    pessoas = (
        db.query(Analista).options(selectinload(Analista.temas))
        .filter(condicao_perfil_visivel(), Analista.lotacao_siorg_id.isnot(None)).all()
    )
    membros: Counter = Counter()
    que_fazem: Counter = Counter()
    for a in pessoas:
        atual = a.lotacao_siorg_id
        while atual in us:  # conta a pessoa na unidade dela e em todas acima
            membros[atual] += 1
            atual = us[atual][0]
        palavras = normalizar(" ".join([a.pode_ajudar or "", *(t.tema for t in a.temas)])).split()
        if _casa(termos, palavras):
            unidade = _com_pagina(us, a.lotacao_siorg_id)
            if permitida(unidade):
                que_fazem[unidade] += 1
                motivo.setdefault(unidade, "pessoas")

    # 3) competência oficial: o banco pré-filtra pela coluna já normalizada; o item exato com
    # todos os termos é conferido depois, só para as unidades que vão aparecer
    condicoes = [UnidadeSiorgDetalhe.competencia_busca.like(f"% {t}{'' if len(t) >= PREFIXO_MINIMO else ' '}%")
                 for t in termos]
    for (i,) in db.execute(select(UnidadeSiorgDetalhe.id).where(*condicoes)):
        if i not in motivo and permitida(i):
            motivo[i] = "competencia"

    if not motivo:
        return {"total": 0, "itens": []}

    meu_orgao = us[eu.lotacao_siorg_id][1] if eu.lotacao_siorg_id in us else None
    forca = {"nome": 0, "pessoas": 1, "competencia": 2}
    ordenadas = sorted(motivo, key=lambda i: (
        us[i][1] != meu_orgao, forca[motivo[i]], membros[i] == 0, -membros[i], us[i][2], us[i][3].casefold(),
    ))

    # trecho da competência, só para as primeiras; sem um item com todos os termos, a unidade sai
    candidatas = [i for i in ordenadas[: LIMITE * 3] if motivo[i] == "competencia"]
    textos = dict(db.execute(select(UnidadeSiorgDetalhe.id, UnidadeSiorgDetalhe.competencia)
                             .where(UnidadeSiorgDetalhe.id.in_(candidatas))).all()) if candidatas else {}
    trechos = {i: _trecho(textos.get(i) or "", termos) for i in candidatas}
    descartadas = {i for i, t in trechos.items() if not t}

    def caminho(i: int) -> list[str]:
        partes, atual = [], us[i][0]
        while atual in us:
            partes.append(us[atual][4] or us[atual][3])
            atual = us[atual][0]
        return list(reversed(partes))

    finais = [i for i in ordenadas if i not in descartadas]
    return {
        "total": len(finais),
        "itens": [{
            "id": i, "nome": us[i][3], "sigla": us[i][4], "caminho": caminho(i), "membros": membros[i],
            "motivo": motivo[i], "trecho": trechos.get(i), "pessoas_que_fazem": que_fazem[i],
        } for i in finais[:LIMITE]],
    }


# --- Filtro de unidades da busca de pessoas (seletores encadeados) ---

def _filhos(us: dict) -> dict[int, list[int]]:
    if _cache.get("filhos_de") is not us:
        filhos: dict[int, list[int]] = {}
        for i, u in us.items():
            if u[0] is not None:
                filhos.setdefault(u[0], []).append(i)
        _cache["filhos"], _cache["filhos_de"] = filhos, us
    return _cache["filhos"]


def subarvore(db: Session, unidade_id: int) -> set[int]:
    """A unidade e todas as que estão abaixo dela (em qualquer profundidade)."""
    us = _unidades(db)
    filhos = _filhos(us)
    ids, pilha = set(), [unidade_id]
    while pilha:
        i = pilha.pop()
        if i in ids:
            continue
        ids.add(i)
        pilha.extend(filhos.get(i, []))
    return ids


def filtro_unidades(db: Session, unidade_id: int | None) -> dict:
    """Seletores encadeados: um nível por unidade escolhida (órgão, secretaria, ... até o mais
    fundo). Cada nível lista só as unidades com pessoas visíveis nelas ou abaixo delas, em ordem
    alfabética; o último nível é o das filhas da unidade escolhida (se alguma tiver pessoas)."""
    us = _unidades(db)
    filhos = _filhos(us)
    membros: Counter = Counter()
    for (lot,) in db.query(Analista.lotacao_siorg_id).filter(condicao_perfil_visivel(), Analista.lotacao_siorg_id.isnot(None)):
        atual = lot
        while atual in us:
            membros[atual] += 1
            atual = us[atual][0]

    caminho: list[int] = []
    atual = unidade_id if unidade_id in us else None
    while atual is not None and atual in us:
        caminho.append(atual)
        atual = us[atual][0]
    caminho.reverse()

    def opcoes(ids) -> list[dict]:
        com_gente = [i for i in ids if membros[i] > 0]
        com_gente.sort(key=lambda i: normalizar(us[i][3]))
        return [{"id": i, "nome": us[i][3], "sigla": us[i][4], "membros": membros[i]} for i in com_gente]

    niveis = [{"pai": None, "escolhida": caminho[0] if caminho else None,
               "opcoes": opcoes(i for i, u in us.items() if u[0] is None and u[2] == 0)}]
    for k, escolhida in enumerate(caminho):
        filhas = opcoes(filhos.get(escolhida, []))
        if not filhas:
            break
        niveis.append({"pai": {"id": escolhida, "nome": us[escolhida][3], "sigla": us[escolhida][4]},
                       "escolhida": caminho[k + 1] if k + 1 < len(caminho) else None, "opcoes": filhas})
    return {"unidade": caminho[-1] if caminho else None, "niveis": niveis}
