from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, exists, func, case

from auth import get_usuario_regular
from database import get_db
from models import Analista, EventoPerfil, Favorito, Formacao, NivelFormacao, Tema, TemaAtuacao, condicao_perfil_visivel
from novidades import condicao_novidade
from schemas import AnalistaPublico, BuscaResponse

router = APIRouter(prefix="/busca", tags=["busca"])

# Palavras que não ajudam a achar ninguém ("coordenação DE políticas")
PALAVRAS_VAZIAS = {"a", "as", "o", "os", "de", "da", "das", "do", "dos", "e", "em", "na", "no", "para", "com"}
# Tolerância a erro de digitação (só PostgreSQL, com pg_trgm): termos a partir deste tamanho
TERMO_MINIMO_APROXIMADO = 4
SIMILARIDADE_MINIMA = 0.55


def _aplicar_visibilidade(analista: Analista) -> AnalistaPublico:
    result = AnalistaPublico.model_validate(analista)
    if not analista.visibilidade_email_pessoal:
        result = result.model_copy(update={"email_pessoal": None})
    if not analista.visibilidade_celular:
        result = result.model_copy(update={"celular": None})
    return result


def _sem_acento(coluna):
    """Minúsculas e sem acento dos dois lados: "saude" acha "Saúde".
    f_unaccent é criada pela migração (PostgreSQL) e registrada na conexão nos testes."""
    return func.f_unaccent(func.lower(coluna))


def _contem(coluna, termo: str):
    return _sem_acento(coluna).like(func.f_unaccent(func.lower(f"%{termo}%")))


def _parecido(coluna, termo: str):
    return func.word_similarity(func.f_unaccent(func.lower(termo)), _sem_acento(coluna)) >= SIMILARIDADE_MINIMA


def _termos(q: str) -> list[str]:
    return [t for t in q.split() if t.casefold() not in PALAVRAS_VAZIAS][:8]


def _casa_termo(termo: str, aproximado: bool):
    """O termo aparece em algum campo do perfil (nome, lotação, cargo, "em que posso
    ajudar", temas ou formação)."""
    colunas = [
        Analista.nome, Analista.ministerio, Analista.ministerio_sigla, Analista.secretaria,
        Analista.secretaria_sigla, Analista.departamento, Analista.departamento_sigla,
        Analista.coordenacao_geral, Analista.coordenacao, Analista.cargo_fce, Analista.pode_ajudar,
    ]
    condicoes = [_contem(c, termo) for c in colunas]
    condicoes.append(exists().where(TemaAtuacao.analista_id == Analista.id, _contem(TemaAtuacao.tema, termo)))
    # siglas e apelidos do catálogo: "TED" acha quem tem "Termo de execução descentralizada"
    condicoes.append(exists().where(
        TemaAtuacao.analista_id == Analista.id, TemaAtuacao.tema_id == Tema.id, _contem(Tema.apelidos, termo),
    ))
    condicoes.append(exists().where(
        Formacao.analista_id == Analista.id,
        or_(_contem(Formacao.curso, termo), _contem(Formacao.instituicao, termo)),
    ))
    if aproximado and len(termo) >= TERMO_MINIMO_APROXIMADO:
        # erro de digitação: "polítcas", "cuidadso" — no nome e nos temas
        condicoes.append(_parecido(Analista.nome, termo))
        condicoes.append(exists().where(TemaAtuacao.analista_id == Analista.id, _parecido(TemaAtuacao.tema, termo)))
    return or_(*condicoes)


@router.get("", response_model=BuscaResponse)
def buscar(
    q: str | None = Query(None, description="Palavras-chave: cada uma precisa aparecer em algum campo "
                                             "(nome, lotação, cargo, em que posso ajudar, temas, formação). "
                                             "Ignora acentos e maiúsculas."),
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
                    "Na relevância e no nome, os favoritos de quem está logado vêm primeiro.",
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=30),
    db: Session = Depends(get_db),
    eu: Analista = Depends(get_usuario_regular),
):
    query = db.query(Analista).filter(condicao_perfil_visivel())
    pode_aproximar = db.get_bind().dialect.name == "postgresql"
    termos = _termos(q or "")

    if ministerio:
        query = query.filter(or_(_contem(Analista.ministerio, ministerio), _contem(Analista.ministerio_sigla, ministerio)))

    if secretaria:
        query = query.filter(or_(_contem(Analista.secretaria, secretaria), _contem(Analista.secretaria_sigla, secretaria)))

    if tema:
        # tema do catálogo: nome exato (o filtro "Saúde" não traz quem só tem "Saúde mental")
        query = query.filter(exists().where(
            TemaAtuacao.analista_id == Analista.id,
            _sem_acento(func.trim(TemaAtuacao.tema)) == func.f_unaccent(func.lower(tema.strip())),
        ))

    if formacao:
        query = query.filter(exists().where(
            Formacao.analista_id == Analista.id,
            or_(_contem(Formacao.curso, formacao), _contem(Formacao.instituicao, formacao)),
        ))

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

    # Palavras-chave: primeiro só correspondência de verdade. A tolerância a erro de digitação
    # é plano B, quando ninguém corresponde ("transferegov" não pode trazer "Transferência").
    base = query
    for termo in termos:
        query = query.filter(_casa_termo(termo, False))
    aproximado = False
    if termos and pode_aproximar and query.count() == 0:
        query = base
        for termo in termos:
            query = query.filter(_casa_termo(termo, True))
        aproximado = True

    eh_favorito = exists().where(Favorito.analista_id == eu.id, Favorito.favorito_id == Analista.id)
    favoritos_primeiro = case((eh_favorito, 0), else_=1)
    # Buscando por nome, quem tem todos os termos no nome vem antes de quem só os tem nos temas
    nome_primeiro = (
        case((and_(*[_contem(Analista.nome, t) for t in termos]), 0), else_=1) if termos else None
    )

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
        + case((Analista.pode_ajudar.isnot(None), 1), else_=0)
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
    # "Chegaram há pouco" é sobre chegada: os favoritos não passam na frente
    ordenacao = ([] if ordem == "recentes" else [favoritos_primeiro])         + ([nome_primeiro] if nome_primeiro is not None else []) + list(criterios)
    analistas = (
        query
        .order_by(*ordenacao)
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
        aproximado=aproximado,
    )
