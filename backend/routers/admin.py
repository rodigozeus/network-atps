import csv
import io
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from auth import get_current_admin
from database import get_db
from email_utils import enviar_email_conta_ativada
from models import Analista, ConflitoCadastro, Formacao, NivelFormacao, Role, TemaAtuacao
import lotacao_siorg
import novidades
from lotacao_auto import normalizar
from models import BaseAtps, UnidadeSiorg, condicao_perfil_visivel
from routers.perfil import remover_foto
from schemas import (
    AdminStats,
    AnalistaAdminOut,
    AnalistaAdminUpdate,
    ConflitoCadastroOut,
    CoberturaOut,
    FormacaoStat,
    MinistrioStat,
    PaginatedAdminUsers,
    TemaStat,
    VisitasDia,
    VisitasStats,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _confirmar_vinculo_manual(analista: Analista) -> None:
    """Admin atesta o vínculo com a carreira: aprova cadastro pendente ou anula uma
    suspensão. A reverificação automática não suspende mais esta conta."""
    analista.pendente_revisao = False
    analista.motivo_pendencia = None
    analista.vinculo_suspenso_em = None
    analista.vinculo_manual = True
    analista.cpf_verificado_em = datetime.now(timezone.utc)


@router.get("/usuarios", response_model=PaginatedAdminUsers)
def listar_usuarios(
    q: str | None = Query(None, description="Filtro por nome ou email"),
    ativo: bool | None = Query(None, description="Filtra por status da conta"),
    pendente_revisao: bool | None = Query(None, description="Filtra por cadastros pendentes de revisão"),
    alerta_vinculo: bool = Query(False, description="Só contas com vínculo suspenso ou não confirmado"),
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

    if alerta_vinculo:
        query = query.filter(or_(
            Analista.vinculo_suspenso_em.isnot(None),
            and_(Analista.ativo.is_(True), Analista.motivo_pendencia.isnot(None)),
        ))

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

    lotacao_antes = novidades.foto_lotacao(analista)
    for field, value in updates.items():
        setattr(analista, field, value)
    if novidades.foto_lotacao(analista) != lotacao_antes:
        analista.lotacao_siorg_id = lotacao_siorg.resolver(db, analista)

    if updates.get('ativo') is True and analista.pendente_revisao:
        _confirmar_vinculo_manual(analista)

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

    remover_foto(analista.foto_path)
    db.delete(analista)
    db.commit()


@router.post("/usuarios/{analista_id}/reativar", response_model=AnalistaAdminOut)
def reativar_usuario(
    analista_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: Analista = Depends(get_current_admin),
):
    analista = db.get(Analista, analista_id)
    if analista is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista não encontrado")

    ativou_conta = not analista.ativo
    if analista.pendente_revisao:
        _confirmar_vinculo_manual(analista)
    analista.ativo = True
    db.commit()
    db.refresh(analista)

    if ativou_conta:
        background_tasks.add_task(enviar_email_conta_ativada, analista.email_pessoal, analista.nome)

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
        (Formacao.nivel == NivelFormacao.pos_doutorado, 5),
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
        (highest_subq.c.max_priority == 5, "Pós-doutorado"),
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

    # visitas (uma por sessão do navegador), no horário de Brasília
    from datetime import timedelta as _td
    from models import Acesso
    hoje = (datetime.now(timezone.utc) - _td(hours=3)).date()
    desde30 = hoje - _td(days=29)
    rede = db.query(Acesso).filter(Acesso.tipo == "rede")
    por_dia = {
        d: (v, p) for d, v, p in db.query(Acesso.dia, func.count(), func.count(func.distinct(Acesso.analista_id)))
        .filter(Acesso.tipo == "rede", Acesso.dia >= desde30).group_by(Acesso.dia)
    }
    visitas = VisitasStats(
        hoje=por_dia.get(hoje, (0, 0))[0],
        ultimos_7=sum(v for d, (v, _) in por_dia.items() if d > hoje - _td(days=7)),
        ultimos_30=sum(v for v, _ in por_dia.values()),
        total=rede.count(),
        pessoas_30=rede.filter(Acesso.dia >= desde30).with_entities(func.count(func.distinct(Acesso.analista_id))).scalar() or 0,
        publica_30=db.query(Acesso).filter(Acesso.tipo == "sobre", Acesso.dia >= desde30).count(),
        por_dia=[VisitasDia(dia=(desde30 + _td(days=i)).isoformat(),
                            visitas=por_dia.get(desde30 + _td(days=i), (0, 0))[0],
                            pessoas=por_dia.get(desde30 + _td(days=i), (0, 0))[1]) for i in range(30)],
    )

    return AdminStats(
        visitas=visitas,
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
        "cargo_fce", "portal_url", "linkedin_url", "lattes_url", "role", "ativo",
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
            a.cargo_fce or "", a.portal_url or "", a.linkedin_url or "", a.lattes_url or "",
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


@router.get("/conflitos", response_model=list[ConflitoCadastroOut])
def listar_conflitos(
    resolvido: bool = Query(False),
    db: Session = Depends(get_db),
    _: Analista = Depends(get_current_admin),
):
    """Tentativas de cadastro com CPF que já pertence a uma conta existente."""
    conflitos = (
        db.query(ConflitoCadastro)
        .filter(ConflitoCadastro.resolvido == resolvido)
        .order_by(ConflitoCadastro.criado_em.desc())
        .all()
    )
    return [
        ConflitoCadastroOut(
            id=c.id,
            analista_id=c.analista_id,
            analista_nome=c.analista.nome,
            analista_email=c.analista.email_pessoal,
            nome_informado=c.nome_informado,
            email_informado=c.email_informado,
            resolvido=c.resolvido,
            criado_em=c.criado_em,
        )
        for c in conflitos
    ]


@router.post("/conflitos/{conflito_id}/resolver", status_code=status.HTTP_204_NO_CONTENT)
def resolver_conflito(
    conflito_id: int,
    db: Session = Depends(get_db),
    _: Analista = Depends(get_current_admin),
):
    conflito = db.get(ConflitoCadastro, conflito_id)
    if conflito is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conflito não encontrado")
    conflito.resolvido = True
    db.commit()


@router.post("/usuarios/{analista_id}/confirmar-vinculo", response_model=AnalistaAdminOut)
def confirmar_vinculo(
    analista_id: int,
    db: Session = Depends(get_db),
    _: Analista = Depends(get_current_admin),
):
    """Confirma manualmente o vínculo (ex.: contestação aceita) e limpa alertas."""
    analista = db.get(Analista, analista_id)
    if analista is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista não encontrado")
    _confirmar_vinculo_manual(analista)
    db.commit()
    db.refresh(analista)
    return analista


@router.get("/cobertura", response_model=CoberturaOut)
def cobertura(db: Session = Depends(get_db), _: Analista = Depends(get_current_admin)):
    """Quantos ATPS de cada órgão estão na Rede, comparado ao universo da cópia local da
    base do Portal (ATPS ativos por órgão de exercício), e cadastros por dia."""
    orgaos = {o.id: o for o in db.scalars(select(UnidadeSiorg).where(UnidadeSiorg.profundidade == 0))}
    por_nome = {normalizar(o.nome): o.id for o in orgaos.values()}
    orgao_da_unidade = dict(db.execute(select(UnidadeSiorg.id, UnidadeSiorg.orgao_id)).all())

    universo: dict[int | None, int] = {}
    for orgao_id, n in db.execute(select(BaseAtps.orgao_siorg_id, func.count()).group_by(BaseAtps.orgao_siorg_id)):
        universo[orgao_id] = n
    referencia = db.scalar(select(func.max(BaseAtps.referencia)))

    rede: dict[int | None, int] = {}
    membros = db.query(Analista).filter(condicao_perfil_visivel()).all()
    for a in membros:
        orgao_id = orgao_da_unidade.get(a.lotacao_siorg_id) if a.lotacao_siorg_id else None
        if orgao_id is None and a.ministerio:
            orgao_id = por_nome.get(normalizar(a.ministerio))
        rede[orgao_id] = rede.get(orgao_id, 0) + 1

    linhas = []
    for orgao_id in (set(universo) | set(rede)) - {None}:
        o = orgaos.get(orgao_id)
        if o is None:
            continue
        linhas.append({"orgao_id": o.id, "nome": o.nome, "sigla": o.sigla,
                       "universo": universo.get(orgao_id, 0), "rede": rede.get(orgao_id, 0)})
    linhas.sort(key=lambda l: (-l["universo"], -l["rede"], l["nome"]))

    desde = datetime.now(timezone.utc).date().toordinal() - 29
    dias: dict[str, int] = {}
    for a in db.query(Analista).all():
        if a.criado_em and a.criado_em.date().toordinal() >= desde:
            dia = a.criado_em.date().isoformat()
            dias[dia] = dias.get(dia, 0) + 1

    return CoberturaOut(
        referencia=referencia,
        total_universo=sum(universo.values()),
        total_rede=len(membros),
        orgaos=linhas,
        sem_orgao_universo=universo.get(None, 0),
        sem_orgao_rede=rede.get(None, 0),
        cadastros_por_dia=[{"dia": d, "total": n} for d, n in sorted(dias.items())],
    )
