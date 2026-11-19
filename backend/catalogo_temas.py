"""Catálogo de temas: normalização, busca aproximada e temas parecidos.

Tudo em Python (o catálogo tem centenas de itens, não milhões), o que funciona igual no Postgres e
no SQLite dos testes.
"""
from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import Tema, TemaAtuacao

MAX_POR_TIPO = 8
PARECIDO = 0.7  # a partir daqui, dois temas são "parecidos" (atrito ao criar, par na curadoria)
_PALAVRAS_VAZIAS = {"a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos",
                    "para", "por", "com", "ao", "aos", "à", "às"}
_SIGLA = re.compile(r"^[A-ZÀ-Ü0-9&'.+/-]{2,}$")


def normalizar(nome: str) -> str:
    """Espaços e pontuação nas pontas; frase em minúsculas ganha inicial maiúscula; TUDO EM
    MAIÚSCULAS longo vira frase (siglas curtas ficam como estão)."""
    s = re.sub(r"\s+", " ", nome or "").strip().strip(".;,:-–— ").strip()
    if not s:
        return ""
    palavras = s.split(" ")
    if s.isupper() and len(palavras) > 1:
        s = " ".join(p if _SIGLA.match(p) and len(p) <= 5 and p.lower() not in _PALAVRAS_VAZIAS else p.lower() for p in palavras)
    return s[0].upper() + s[1:]


def chave(texto: str) -> str:
    """Comparação: sem acento, minúsculas, só letras e números."""
    t = unicodedata.normalize("NFKD", (texto or "").lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9]+", " ", t.replace("'", ""))
    return re.sub(r"\s+", " ", t).strip()


def _tokens(k: str) -> list[str]:
    return [p for p in k.split(" ") if p and p not in _PALAVRAS_VAZIAS]


def _token_casa(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if len(a) < 4 or len(b) < 4:
        return 0.0
    r = SequenceMatcher(None, a, b).ratio()
    return r if r >= 0.84 else 0.0


def similaridade(a: str, b: str) -> float:
    """0 a 1. Junta a semelhança do texto inteiro com a de palavras (aceitando erro de digitação),
    para pegar tanto "Avaliação de polítcas" quanto "Síntese de evidências (para políticas)"."""
    ka, kb = chave(a), chave(b)
    if not ka or not kb:
        return 0.0
    if ka == kb:
        return 1.0
    inteiro = 0.9 * SequenceMatcher(None, ka, kb).ratio()
    ta, tb = _tokens(ka), _tokens(kb)
    if not ta or not tb:
        return inteiro
    menor, maior = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    casadas = sum(max(_token_casa(p, q) for q in maior) for p in menor)
    cobertura = casadas / len(menor)
    # uma palavra só em comum entre temas de várias palavras não basta ("Gestão de X" x "Gestão de Y")
    if len(menor) == 1 and len(maior) > 2:
        cobertura *= 0.75
    return max(inteiro, 0.92 * cobertura * (0.85 + 0.15 * len(menor) / len(maior)))


def pontuacao_busca(q: str, tema: Tema) -> float:
    """Quanto o tema combina com o que a pessoa está digitando (q pode ser uma palavra pela metade)."""
    kq = chave(q)
    if not kq:
        return 0.5
    melhor = 0.0
    for nome in [tema.nome, *tema.lista_apelidos]:
        k = chave(nome)
        if k == kq:
            return 1.0
        if k.startswith(kq):
            melhor = max(melhor, 0.95)
            continue
        if f" {kq}" in f" {k}":
            melhor = max(melhor, 0.9)
            continue
        if kq in k:
            melhor = max(melhor, 0.8)
            continue
        # cada palavra digitada casa com o começo de alguma palavra do tema (com erro de digitação)
        tq, tk = _tokens(kq) or kq.split(" "), k.split(" ")
        notas = []
        for p in tq:
            n = 0.0
            for w in tk:
                if w.startswith(p):
                    n = 1.0
                    break
                if len(p) >= 4:
                    n = max(n, SequenceMatcher(None, p, w[: len(p) + 1]).ratio())
            notas.append(n)
        if notas and min(notas) >= 0.75:
            melhor = max(melhor, 0.55 + 0.25 * sum(notas) / len(notas))
    # frase mais longa ou mais específica que o tema ("avaliação de impacto do programa X"):
    # mostra o parecido no fim da lista, para a pessoa preferir o tema que já existe
    if melhor == 0 and len(kq) >= 6:
        s = max([similaridade(q, tema.nome), *(similaridade(q, a) for a in tema.lista_apelidos)])
        if s >= PARECIDO:
            melhor = 0.4 * s
    return melhor


def totais(db: Session) -> dict[int, int]:
    """Quantas pessoas usam cada tema do catálogo."""
    q = select(TemaAtuacao.tema_id, func.count(func.distinct(TemaAtuacao.analista_id))).group_by(TemaAtuacao.tema_id)
    return {i: n for i, n in db.execute(q) if i is not None}


def achar_exato(db: Session, nome: str) -> Tema | None:
    """Tema cujo nome ou apelido é o mesmo texto (sem acento/caixa/pontuação)."""
    k = chave(nome)
    if not k:
        return None
    for t in db.scalars(select(Tema)):
        if chave(t.nome) == k or any(chave(a) == k for a in t.lista_apelidos):
            return t  # pode ser um reprovado: quem chama decide (bloquear)
    return None


def parecidos(db: Session, nome: str, *, limite: int = 5, excluir: int | None = None) -> list[tuple[Tema, float]]:
    res = []
    for t in db.scalars(select(Tema).where(Tema.reprovado.is_(False))):
        if t.id == excluir:
            continue
        s = max([similaridade(nome, t.nome), *(similaridade(nome, a) for a in t.lista_apelidos)])
        if s >= PARECIDO:
            res.append((t, s))
    res.sort(key=lambda x: -x[1])
    return res[:limite]


def pares_parecidos(db: Session, *, so_a_revisar: bool = True, limite: int = 60) -> list[tuple[Tema, Tema, float]]:
    """Pares de temas parecidos para a curadoria. Por padrão, só os que envolvem um tema a revisar
    (mantém a conta leve e mostra o que importa)."""
    temas = list(db.scalars(select(Tema).where(Tema.reprovado.is_(False))))
    base = [t for t in temas if not t.revisado] if so_a_revisar else temas
    vistos, pares = set(), []
    for a in base:
        for b in temas:
            if a.id == b.id or (min(a.id, b.id), max(a.id, b.id)) in vistos:
                continue
            s = max([similaridade(a.nome, b.nome), *(similaridade(a.nome, x) for x in b.lista_apelidos)])
            if s >= PARECIDO:
                vistos.add((min(a.id, b.id), max(a.id, b.id)))
                pares.append((a, b, s))
    pares.sort(key=lambda x: -x[2])
    return pares[:limite]
