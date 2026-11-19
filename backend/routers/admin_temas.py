"""Curadoria do catálogo de temas (painel admin > Temas): revisar temas novos, renomear, mudar o
tipo, apelidos, juntar duplicados e excluir os que ninguém usa."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import catalogo_temas
import novidades
from auth import get_current_admin
from catalogo_temas import chave, normalizar
from database import get_db
from models import Analista, Tema, TemaAtuacao
from schemas import TemaAdminIn, TemaAdminOut, TemaAdminUpdate, TemaJuntarIn, TemaParOut, TemaReprovarIn, TemasAdminOut

router = APIRouter(prefix="/admin/temas", tags=["admin"])


def _saida(t: Tema, totais: dict[int, int], nomes: dict[int, str]) -> TemaAdminOut:
    return TemaAdminOut(
        id=t.id, nome=t.nome, tipo=t.tipo, apelidos=t.lista_apelidos, revisado=t.revisado, reprovado=t.reprovado,
        total=totais.get(t.id, 0), criado_em=t.criado_em, criado_por=nomes.get(t.criado_por_id or 0),
    )


def _nomes_autores(db: Session, temas: list[Tema]) -> dict[int, str]:
    ids = {t.criado_por_id for t in temas if t.criado_por_id}
    if not ids:
        return {}
    return dict(db.execute(select(Analista.id, Analista.nome).where(Analista.id.in_(ids))).all())


def _conflito(db: Session, textos: list[str], ignorar: int | None) -> str | None:
    """Algum dos textos já é nome ou apelido de OUTRO tema? Devolve o nome desse tema."""
    chaves = {chave(x) for x in textos if chave(x)}
    for t in db.scalars(select(Tema)):
        if t.id == ignorar:
            continue
        if chaves & {chave(t.nome), *(chave(a) for a in t.lista_apelidos)}:
            return t.nome
    return None


def _limpar_apelidos(apelidos: list[str], nome: str) -> list[str]:
    vistos, saida = {chave(nome)}, []
    for a in apelidos:
        a = normalizar(a) if a.strip() and not a.strip().isupper() else a.strip()
        if a and chave(a) and chave(a) not in vistos:
            vistos.add(chave(a))
            saida.append(a[:120])
    return saida


def _pegar(db: Session, tema_id: int) -> Tema:
    t = db.get(Tema, tema_id)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tema não encontrado.")
    return t


@router.get("", response_model=TemasAdminOut)
def listar(todos_os_pares: bool = False, db: Session = Depends(get_db), _: Analista = Depends(get_current_admin)):
    """Catálogo inteiro (a revisar primeiro) e pares de temas parecidos para juntar."""
    temas = list(db.scalars(select(Tema)))
    totais = catalogo_temas.totais(db)
    nomes = _nomes_autores(db, temas)
    temas.sort(key=lambda t: (t.revisado, -totais.get(t.id, 0), chave(t.nome)))
    pares = catalogo_temas.pares_parecidos(db, so_a_revisar=not todos_os_pares)
    return TemasAdminOut(
        temas=[_saida(t, totais, nomes) for t in temas],
        pares=[TemaParOut(a=_saida(a, totais, nomes), b=_saida(b, totais, nomes), similaridade=round(s, 2))
               for a, b, s in pares],
    )


@router.post("", response_model=TemaAdminOut, status_code=status.HTTP_201_CREATED)
def criar(body: TemaAdminIn, db: Session = Depends(get_db), _: Analista = Depends(get_current_admin)):
    nome = normalizar(body.nome)
    apelidos = _limpar_apelidos(body.apelidos, nome)
    if (outro := _conflito(db, [nome, *apelidos], None)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Já existe o tema “{outro}” com esse nome ou apelido.")
    t = Tema(nome=nome, tipo=body.tipo, apelidos="\n".join(apelidos), revisado=True)
    db.add(t)
    db.commit()
    db.refresh(t)
    return _saida(t, {}, {})


@router.patch("/{tema_id}", response_model=TemaAdminOut)
def editar(tema_id: int, body: TemaAdminUpdate, db: Session = Depends(get_db), _: Analista = Depends(get_current_admin)):
    """Renomear (o nome antigo vira apelido e os perfis passam a mostrar o novo), mudar o tipo,
    editar apelidos ou marcar como revisado."""
    t = _pegar(db, tema_id)
    nome = normalizar(body.nome) if body.nome is not None else t.nome
    apelidos = t.lista_apelidos if body.apelidos is None else body.apelidos
    if nome != t.nome and chave(nome) != chave(t.nome):
        apelidos = [*apelidos, t.nome]
    apelidos = _limpar_apelidos(apelidos, nome)
    if (outro := _conflito(db, [nome, *apelidos], t.id)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"“{outro}” já usa esse nome ou apelido. Para unir os dois, use Juntar.",
        )
    if nome != t.nome:
        for ta in db.scalars(select(TemaAtuacao).where(TemaAtuacao.tema_id == t.id)):
            ta.tema = nome
        t.nome = nome
    t.apelidos = "\n".join(apelidos)
    if body.tipo is not None:
        t.tipo = body.tipo
    if body.revisado is not None:
        t.revisado = body.revisado
    if body.reprovado is False:  # desfazer: o nome volta a poder ser usado (os perfis não voltam)
        t.reprovado = False
    db.commit()
    db.refresh(t)
    return _saida(t, catalogo_temas.totais(db), _nomes_autores(db, [t]))


@router.post("/{tema_id}/juntar", response_model=TemaAdminOut)
def juntar(tema_id: int, body: TemaJuntarIn, db: Session = Depends(get_db), _: Analista = Depends(get_current_admin)):
    """Junta o tema {tema_id} no destino: todo mundo que tinha o primeiro passa a ter o destino,
    o nome e os apelidos do primeiro viram apelidos do destino, e o primeiro deixa de existir."""
    origem, destino = _pegar(db, tema_id), _pegar(db, body.destino_id)
    if origem.id == destino.id or destino.reprovado:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Escolha outro tema para juntar.")
    ja_tem = {ta.analista_id: ta for ta in db.scalars(select(TemaAtuacao).where(TemaAtuacao.tema_id == destino.id))}
    for ta in list(db.scalars(select(TemaAtuacao).where(TemaAtuacao.tema_id == origem.id))):
        existente = ja_tem.get(ta.analista_id)
        if existente is not None:
            existente.em_exercicio_atual = existente.em_exercicio_atual or ta.em_exercicio_atual
            novidades.remover_item(db, "tema", ta.id)
            db.delete(ta)
        else:
            ta.tema_id, ta.tema, ta.catalogo = destino.id, destino.nome, destino
            ja_tem[ta.analista_id] = ta
    destino.apelidos = "\n".join(_limpar_apelidos([*destino.lista_apelidos, origem.nome, *origem.lista_apelidos], destino.nome))
    db.flush()
    db.delete(origem)
    db.commit()
    db.refresh(destino)
    return _saida(destino, catalogo_temas.totais(db), _nomes_autores(db, [destino]))


@router.post("/{tema_id}/reprovar", response_model=TemaAdminOut)
def reprovar(tema_id: int, body: TemaReprovarIn, db: Session = Depends(get_db), _: Analista = Depends(get_current_admin)):
    """Tira o tema do catálogo e dos perfis e bloqueia o nome. Com substituto, quem tinha o tema
    passa a ter o substituto (sem virar apelido dele, ao contrário de Juntar)."""
    t = _pegar(db, tema_id)
    destino = _pegar(db, body.substituto_id) if body.substituto_id is not None else None
    if destino is not None and (destino.id == t.id or destino.reprovado):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Escolha outro tema para colocar no lugar.")
    ja_tem = set() if destino is None else set(db.scalars(
        select(TemaAtuacao.analista_id).where(TemaAtuacao.tema_id == destino.id)))
    for ta in list(db.scalars(select(TemaAtuacao).where(TemaAtuacao.tema_id == t.id))):
        if destino is not None and ta.analista_id not in ja_tem:
            ta.tema_id, ta.tema, ta.catalogo = destino.id, destino.nome, destino
            ja_tem.add(ta.analista_id)
        else:
            novidades.remover_item(db, "tema", ta.id)
            db.delete(ta)
    t.reprovado, t.revisado = True, True
    db.commit()
    db.refresh(t)
    return _saida(t, catalogo_temas.totais(db), _nomes_autores(db, [t]))


@router.delete("/{tema_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(tema_id: int, db: Session = Depends(get_db), _: Analista = Depends(get_current_admin)):
    """Só temas que ninguém usa; para os usados, juntar com outro."""
    t = _pegar(db, tema_id)
    if catalogo_temas.totais(db).get(t.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Há pessoas com esse tema. Junte-o a outro tema em vez de excluir.")
    db.delete(t)
    db.commit()
