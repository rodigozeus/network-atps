"""Páginas de unidade: o que cada órgão ou unidade faz (competência oficial do SIORG),
contato institucional e quem da Rede está ali."""
import json
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import siorg
from auth import get_usuario_regular
from database import get_db
from lotacao_auto import CAMPOS
from models import Analista, UnidadeSiorg, condicao_perfil_visivel
from routers.busca import _aplicar_visibilidade
from schemas import OrgaoResumoOut, UnidadeOut

router = APIRouter(prefix="/unidades", tags=["unidades"])

LIMITE_MEMBROS = 120


def _membros_por_unidade(db: Session) -> Counter:
    """Perfis visíveis por código SIORG da lotação (unidade mais funda)."""
    stmt = select(Analista.lotacao_siorg_id).where(condicao_perfil_visivel(), Analista.lotacao_siorg_id.isnot(None))
    return Counter(db.scalars(stmt))


@router.get("", response_model=list[OrgaoResumoOut])
def listar_orgaos(db: Session = Depends(get_db), _: Analista = Depends(get_usuario_regular)):
    """Órgãos da estrutura oficial com quantas pessoas da Rede estão em cada um."""
    orgao_da_unidade = dict(db.execute(select(UnidadeSiorg.id, UnidadeSiorg.orgao_id)).all())
    por_orgao = Counter()
    for unidade_id, n in _membros_por_unidade(db).items():
        por_orgao[orgao_da_unidade.get(unidade_id)] += n
    orgaos = db.scalars(select(UnidadeSiorg).where(UnidadeSiorg.profundidade == 0))
    lista = [OrgaoResumoOut(id=o.id, nome=o.nome, sigla=o.sigla, membros=por_orgao.get(o.id, 0)) for o in orgaos]
    return sorted(lista, key=lambda o: (-o.membros, o.nome.casefold()))


@router.get("/{unidade_id}", response_model=UnidadeOut)
def ver_unidade(unidade_id: int, db: Session = Depends(get_db), _: Analista = Depends(get_usuario_regular)):
    unidade = db.get(UnidadeSiorg, unidade_id)
    if unidade is None or unidade.profundidade > max(CAMPOS):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidade não encontrada")

    # árvore do órgão em memória: filhos e subárvore
    do_orgao = list(db.scalars(select(UnidadeSiorg).where(UnidadeSiorg.orgao_id == unidade.orgao_id)))
    por_id = {u.id: u for u in do_orgao}
    filhos: dict[int, list[UnidadeSiorg]] = {}
    for u in do_orgao:
        if u.pai_id is not None:
            filhos.setdefault(u.pai_id, []).append(u)

    def subarvore(raiz: int) -> set[int]:
        ids, pilha = set(), [raiz]
        while pilha:
            i = pilha.pop()
            ids.add(i)
            pilha.extend(f.id for f in filhos.get(i, []))
        return ids

    contagem = _membros_por_unidade(db)
    abaixo = subarvore(unidade.id)

    caminho = []
    atual = por_id.get(unidade.pai_id) if unidade.pai_id else None
    while atual is not None:
        caminho.append({"id": atual.id, "nome": atual.nome, "sigla": atual.sigla})
        atual = por_id.get(atual.pai_id) if atual.pai_id else None
    caminho.reverse()

    sub = [
        {"id": f.id, "nome": f.nome, "sigla": f.sigla, "membros": sum(contagem.get(i, 0) for i in subarvore(f.id))}
        for f in filhos.get(unidade.id, []) if f.profundidade <= max(CAMPOS)
    ]
    sub.sort(key=lambda f: (-f["membros"], f["nome"].casefold()))

    pessoas = (
        db.query(Analista)
        .filter(condicao_perfil_visivel(), Analista.lotacao_siorg_id.in_(abaixo))
        .all()
    )
    # primeiro quem está exatamente na unidade, depois os das unidades abaixo
    pessoas.sort(key=lambda a: (a.lotacao_siorg_id != unidade.id, a.nome.casefold()))
    temas = Counter()
    for a in pessoas:
        for t in {t.tema.strip() for t in a.temas}:
            temas[t] += 1

    det = siorg.detalhe(db, unidade.id)
    contato = json.loads(det.contato) if det and det.contato else None
    return UnidadeOut(
        id=unidade.id, nome=unidade.nome, sigla=unidade.sigla, profundidade=unidade.profundidade,
        nivel=CAMPOS[unidade.profundidade][0], caminho=caminho, subunidades=sub,
        competencia=det.competencia if det else None, contato=contato,
        endereco=det.endereco if det else None,
        membros_aqui=sum(1 for a in pessoas if a.lotacao_siorg_id == unidade.id),
        membros_total=len(pessoas),
        membros=[_aplicar_visibilidade(a) for a in pessoas[:LIMITE_MEMBROS]],
        temas=[{"tema": t, "total": n} for t, n in temas.most_common(15)],
    )
