import csv
import io
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from auth import get_current_admin
from database import get_db
from email_utils import enviar_email_conta_ativada
from models import Analista, Formacao, NivelFormacao, Role, TemaAtuacao
from schemas import (
    AdminStats,
    AnalistaAdminOut,
    AnalistaAdminUpdate,
    FormacaoStat,
    MinistrioStat,
    PaginatedAdminUsers,
    TemaStat,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/usuarios", response_model=PaginatedAdminUsers)
def listar_usuarios(
    q: str | None = Query(None, description="Filtro por nome ou email"),
    ativo: bool | None = Query(None, description="Filtra por status da conta"),
    pendente_revisao: bool | None = Query(None, description="Filtra por cadastros pendentes de revisão"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: Analista = Depends(get_current_admin),
):
    query = db.query(Analista)

    if q:
        kw = f"%{q}%"
        query = query.filter(or_(
            Analista.nome.ilike(kw),
            Analista.email_pessoal.ilike(kw),
        ))

    if ativo is not None:
        query = query.filter(Analista.ativo == ativo)

    if pendente_revisao is not None:
        query = query.filter(Analista.pendente_revisao == pendente_revisao)

    total = query.count()
    analistas = (
        query
        .order_by(Analista.nome)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedAdminUsers(
        items=analistas,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.put("/usuarios/{analista_id}", response_model=AnalistaAdminOut)
def editar_usuario(
    analista_id: int,
    body: AnalistaAdminUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: Analista = Depends(get_current_admin),
):
    analista = db.get(Analista, analista_id)
    if analista is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista não encontrado")

    from models import Role
    if admin.role == Role.andeps:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para editar perfis")

    if analista_id == admin.id and body.role is not None and body.role != Role.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin não pode rebaixar a si mesmo",
        )

    updates = body.model_dump(exclude_unset=True)
    ativou_conta = updates.get('ativo') is True and not analista.ativo

    for field, value in updates.items():
        setattr(analista, field, value)

    if updates.get('ativo') is True:
        analista.pendente_revisao = False

    db.commit()
    db.refresh(analista)

    if ativou_conta:
        background_tasks.add_task(enviar_email_conta_ativada, analista.email_pessoal, analista.nome)

    return analista


@router.delete("/usuarios/{analista_id}", status_code=status.HTTP_200_OK)
def desativar_usuario(
    analista_id: int,
    db: Session = Depends(get_db),
    admin: Analista = Depends(get_current_admin),
):
    if analista_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin não pode desativar a si mesmo",
        )

    analista = db.get(Analista, analista_id)
    if analista is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista não encontrado")

    from models import Role
    if admin.role == Role.andeps and analista.role == Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para desativar um administrador")

    analista.ativo = False
    db.commit()
    return {"ok": True}


@router.delete("/usuarios/{analista_id}/excluir", status_code=status.HTTP_204_NO_CONTENT)
def excluir_usuario(
    analista_id: int,
    db: Session = Depends(get_db),
    admin: Analista = Depends(get_current_admin),
):
    if admin.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores podem excluir perfis")

    if analista_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin não pode excluir a si mesmo")

    analista = db.get(Analista, analista_id)
    if analista is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista não encontrado")

    db.delete(analista)
    db.commit()


@router.post("/usuarios/{analista_id}/reativar", response_model=AnalistaAdminOut)
def reativar_usuario(
    analista_id: int,
    db: Session = Depends(get_db),
    _: Analista = Depends(get_current_admin),
):
    analista = db.get(Analista, analista_id)
    if analista is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista não encontrado")
    analista.ativo = True
    analista.pendente_revisao = False
    db.commit()
    db.refresh(analista)
    return analista


@router.get("/stats", response_model=AdminStats)
def get_stats(
    db: Session = Depends(get_db),
    _: Analista = Depends(get_current_admin),
):
    total = db.query(func.count(Analista.id)).scalar() or 0
    total_ativos = db.query(func.count(Analista.id)).filter(Analista.ativo == True).scalar() or 0

    por_ministerio_rows = (
        db.query(Analista.ministerio_sigla, func.count(Analista.id).label("total"))
        .filter(Analista.ativo == True)
        .group_by(Analista.ministerio_sigla)
        .order_by(func.count(Analista.id).desc())
        .limit(10)
        .all()
    )

    nivel_priority = case(
        (Formacao.nivel == NivelFormacao.graduacao, 1),
        (Formacao.nivel == NivelFormacao.especializacao, 2),
        (Formacao.nivel == NivelFormacao.mestrado, 3),
        (Formacao.nivel == NivelFormacao.doutorado, 4),
        else_=0,
    )
    highest_subq = (
        select(Formacao.analista_id, func.max(nivel_priority).label("max_priority"))
        .group_by(Formacao.analista_id)
        .subquery()
    )
    priority_to_label = case(
        (highest_subq.c.max_priority == 1, "Graduação"),
        (highest_subq.c.max_priority == 2, "Especialização"),
        (highest_subq.c.max_priority == 3, "Mestrado"),
        (highest_subq.c.max_priority == 4, "Doutorado"),
    )
    por_formacao_rows = (
        db.query(priority_to_label.label("nivel"), func.count().label("total"))
        .select_from(highest_subq)
        .group_by(priority_to_label)
        .order_by(func.count().desc())
        .all()
    )

    por_tema_rows = (
        db.query(TemaAtuacao.tema, func.count(TemaAtuacao.id).label("total"))
        .group_by(TemaAtuacao.tema)
        .order_by(func.count(TemaAtuacao.id).desc())
        .limit(10)
        .all()
    )

    return AdminStats(
        total_analistas=total,
        total_ativos=total_ativos,
        total_inativos=total - total_ativos,
        por_ministerio=[MinistrioStat(ministerio_sigla=r[0], total=r[1]) for r in por_ministerio_rows],
        por_nivel_formacao=[FormacaoStat(nivel=r[0], total=r[1]) for r in por_formacao_rows],
        por_tema=[TemaStat(tema=r[0], total=r[1]) for r in por_tema_rows],
    )


@router.get("/export")
def exportar_csv(
    db: Session = Depends(get_db),
    _: Analista = Depends(get_current_admin),
):
    analistas = db.query(Analista).order_by(Analista.nome).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_ALL)

    writer.writerow([
        "id", "nome", "email_pessoal", "email_institucional",
        "telefone_institucional", "celular",
        "ministerio", "ministerio_sigla", "secretaria", "secretaria_sigla",
        "departamento", "departamento_sigla", "coordenacao_geral", "coordenacao",
        "cargo_fce", "portal_url", "role", "ativo",
        "criado_em", "atualizado_em", "formacoes", "temas",
    ])

    for a in analistas:
        formacoes_str = "; ".join(
            f"{f.nivel.value} em {f.curso} ({f.instituicao})" for f in a.formacoes
        )
        temas_str = "; ".join(t.tema for t in a.temas)

        writer.writerow([
            a.id, a.nome, a.email_pessoal, a.email_institucional or "",
            a.telefone_institucional or "", a.celular or "",
            a.ministerio or "", a.ministerio_sigla or "",
            a.secretaria or "", a.secretaria_sigla or "",
            a.departamento or "", a.departamento_sigla or "",
            a.coordenacao_geral or "", a.coordenacao or "",
            a.cargo_fce or "", a.portal_url or "",
            a.role.value, a.ativo,
            a.criado_em.isoformat(), a.atualizado_em.isoformat(),
            formacoes_str, temas_str,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=analistas.csv"},
    )
