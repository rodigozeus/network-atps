from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, exists, func, case

from auth import get_usuario_regular
from database import get_db
from models import Analista, EventoPerfil, Favorito, Formacao, NivelFormacao, TemaAtuacao, condicao_perfil_visivel
from novidades import condicao_novidade
from schemas import AnalistaPublico, BuscaResponse

router = APIRouter(prefix="/busca", tags=["busca"])


def _aplicar_visibilidade(analista: Analista) -> AnalistaPublico:
    result = AnalistaPublico.model_validate(analista)
    if not analista.visibilidade_email_pessoal:
        result = result.model_copy(update={"email_pessoal": None})
    if not analista.visibilidade_celular:
        result = result.model_copy(update={"celular": None})
    return result


@router.get("", response_model=BuscaResponse)
def buscar(
    q: str | None = Query(None, description="Palavra-chave geral (nome, ministério, secretaria, temas)"),
    ministerio: str | None = Query(None, description="Filtra por ministério (sigla ou nome)"),
    secretaria: str | None = Query(None, description="Filtra por secretaria (sigla ou nome)"),
    tema: str | None = Query(None, description="Filtra por tema de atuação"),
    formacao: str | None = Query(None, description="Filtra por curso ou instituição"),
    nivel_formacao: NivelFormacao | None = Query(None, description="Tem formação neste nível"),
    favoritos: bool = Query(False, description="Só analistas favoritados por quem está logado"),
    novidades: bool = Query(False, description="Só favoritos com novidades desde a última visita"),
    ordem: Literal["relevancia", "nome", "recentes"] = Query(
        "relevancia",
        description="relevancia: perfis mais completos primeiro, com rodízio diário; "
                    "nome: ordem alfabética; recentes: quem entrou na Rede há menos tempo. "
                    "Em qualquer ordem, os favoritos de quem está logado vêm primeiro.",
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=30),
    db: Session = Depends(get_db),
    eu: Analista = Depends(get_usuario_regular),
):
    query = db.query(Analista).filter(condicao_perfil_visivel())

    if q:
        kw = f"%{q}%"
        query = query.filter(or_(
            Analista.nome.ilike(kw),
            Analista.ministerio.ilike(kw),
            Analista.ministerio_sigla.ilike(kw),
            Analista.secretaria.ilike(kw),
            Analista.secretaria_sigla.ilike(kw),
            exists().where(
                TemaAtuacao.analista_id == Analista.id,
                TemaAtuacao.tema.ilike(kw),
            ),
        ))

    if ministerio:
        pat = f"%{ministerio}%"
        query = query.filter(or_(
            Analista.ministerio.ilike(pat),
            Analista.ministerio_sigla.ilike(pat),
        ))

    if secretaria:
        pat = f"%{secretaria}%"
        query = query.filter(or_(
            Analista.secretaria.ilike(pat),
            Analista.secretaria_sigla.ilike(pat),
        ))

    if tema:
        pat = f"%{tema}%"
        query = query.filter(
            exists().where(
                TemaAtuacao.analista_id == Analista.id,
                TemaAtuacao.tema.ilike(pat),
            )
        )

    if formacao:
        pat = f"%{formacao}%"
        query = query.filter(
            exists().where(
                Formacao.analista_id == Analista.id,
                or_(
                    Formacao.curso.ilike(pat),
                    Formacao.instituicao.ilike(pat),
                ),
            )
        )

    if nivel_formacao:
        query = query.filter(
            exists().where(
                Formacao.analista_id == Analista.id,
                Formacao.nivel == nivel_formacao,
            )
        )

    if favoritos:
        query = query.filter(
            exists().where(
                Favorito.analista_id == eu.id,
                Favorito.favorito_id == Analista.id,
            )
        )

    if novidades:
        query = query.filter(
            exists().where(
                EventoPerfil.analista_id == Analista.id,
                Favorito.analista_id == eu.id,
                *condicao_novidade(),
            )
        )

    eh_favorito = exists().where(Favorito.analista_id == eu.id, Favorito.favorito_id == Analista.id)
    favoritos_primeiro = case((eh_favorito, 0), else_=1)

    tem_foto = case((Analista.foto_path.is_(None), 1), else_=0)

    campos_preenchidos = (
        case((Analista.email_institucional.isnot(None), 1), else_=0)
        + case((Analista.telefone_institucional.isnot(None), 1), else_=0)
        + case((Analista.celular.isnot(None), 1), else_=0)
        + case((or_(Analista.ministerio.isnot(None), Analista.ministerio_sigla.isnot(None)), 1), else_=0)
        + case((or_(Analista.secretaria.isnot(None), Analista.secretaria_sigla.isnot(None)), 1), else_=0)
        + case((or_(Analista.departamento.isnot(None), Analista.departamento_sigla.isnot(None)), 1), else_=0)
        + case((Analista.coordenacao_geral.isnot(None), 1), else_=0)
        + case((Analista.coordenacao.isnot(None), 1), else_=0)
        + case((Analista.cargo_fce.isnot(None), 1), else_=0)
        + case((Analista.portal_url.isnot(None), 1), else_=0)
        + case((Analista.linkedin_url.isnot(None), 1), else_=0)
        + case((Analista.lattes_url.isnot(None), 1), else_=0)
        + case((Analista.foto_path.isnot(None), 1), else_=0)
        + case((exists().where(Formacao.analista_id == Analista.id), 1), else_=0)
        + case((exists().where(TemaAtuacao.analista_id == Analista.id), 1), else_=0)
    )

    # Rodízio estável: muda a cada dia, mas é o mesmo entre as páginas de uma busca
    # (com random() a página 2 podia repetir ou pular pessoas da página 1).
    semente = date.today().toordinal()
    sorteio = func.mod(Analista.id * 7919 + semente * 104729, 10007)
    score = sorteio * (1 + campos_preenchidos)

    if ordem == "nome":
        criterios = (func.lower(Analista.nome), Analista.id)
    elif ordem == "recentes":
        criterios = (Analista.criado_em.desc(), Analista.id.desc())
    else:
        criterios = (tem_foto, score.desc(), Analista.id)

    total = query.count()
    analistas = (
        query
        .order_by(favoritos_primeiro, *criterios)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    pages = max(1, (total + page_size - 1) // page_size)

    return BuscaResponse(
        items=[_aplicar_visibilidade(a) for a in analistas],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
