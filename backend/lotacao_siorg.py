"""Ligação entre a lotação do perfil (nomes) e a estrutura oficial do SIORG (códigos).

O perfil guarda os nomes (o que aparece na tela) e o código da unidade mais funda
(`lotacao_siorg_id`). Com o código, uma renomeação no SIORG se propaga sozinha para os
perfis, e as páginas de unidade sabem quem está em cada parte da árvore.
"""
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from lotacao_auto import CAMPOS
from models import Analista, UnidadeSiorg

logger = logging.getLogger(__name__)


def _chave(texto: str | None) -> str:
    return " ".join((texto or "").casefold().split())


def resolver(db: Session, a: Analista) -> int | None:
    """Código da unidade mais funda cujo caminho de nomes confere com o perfil."""
    nome0, sigla0 = (getattr(a, c) for c in CAMPOS[0])
    if not (nome0 or sigla0):
        return None
    orgaos = list(db.scalars(select(UnidadeSiorg).where(UnidadeSiorg.profundidade == 0)))
    atual = next((o for o in orgaos if _chave(o.nome) == _chave(nome0)), None)
    if atual is None and sigla0:
        por_sigla = [o for o in orgaos if _chave(o.sigla) == _chave(sigla0)]
        atual = por_sigla[0] if len(por_sigla) == 1 else None
    if atual is None:
        return None
    for prof in range(1, 5):
        nome = getattr(a, CAMPOS[prof][0])
        if not (nome or "").strip():
            break
        filhos = [u for u in db.scalars(select(UnidadeSiorg).where(UnidadeSiorg.pai_id == atual.id))
                  if _chave(u.nome) == _chave(nome)]
        if len(filhos) != 1:
            break
        atual = filhos[0]
    return atual.id


def caminho(db: Session, unidade_id: int | None) -> list[UnidadeSiorg]:
    """Da raiz (órgão) até a unidade."""
    cadeia = []
    atual = db.get(UnidadeSiorg, unidade_id) if unidade_id else None
    while atual is not None:
        cadeia.append(atual)
        atual = db.get(UnidadeSiorg, atual.pai_id) if atual.pai_id else None
    return list(reversed(cadeia))


def propagar(db: Session) -> dict:
    """Depois de sincronizar o SIORG: renomeações chegam aos perfis, unidades extintas
    perdem o código (os nomes ficam) e perfis ainda sem código tentam ganhar um."""
    contagem = {"renomeados": 0, "sem_unidade": 0, "ligados": 0}
    for a in db.query(Analista).all():
        if a.lotacao_siorg_id is not None:
            cadeia = caminho(db, a.lotacao_siorg_id)
            if not cadeia:
                a.lotacao_siorg_id = None
                contagem["sem_unidade"] += 1
                continue
            mudou = False
            for u in cadeia:
                if u.profundidade not in CAMPOS:
                    continue
                c_nome, c_sigla = CAMPOS[u.profundidade]
                novo_nome, nova_sigla = u.nome[:200], ((u.sigla or "")[:30] or None)
                if getattr(a, c_nome) != novo_nome:
                    setattr(a, c_nome, novo_nome)
                    mudou = True
                if c_sigla and getattr(a, c_sigla) != nova_sigla:
                    setattr(a, c_sigla, nova_sigla)
                    mudou = True
            contagem["renomeados"] += mudou
        else:
            novo = resolver(db, a)
            if novo is not None:
                a.lotacao_siorg_id = novo
                contagem["ligados"] += 1
    db.commit()
    return contagem
