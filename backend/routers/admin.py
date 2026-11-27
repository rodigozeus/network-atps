import csv
import io
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from auth import get_current_admin
from database import get_db
from email_utils import enviar_email_conta_ativada
from models import Analista, BaseAtps, ConflitoCadastro, NivelFormacao, Role, TemaAtuacao
import estatisticas
import lotacao_siorg
import novidades
from routers.perfil import completar_pelo_portal, remover_foto
from schemas import (
    AnalistaAdminOut,
    AnalistaAdminUpdate,
    ConflitoCadastroOut,
    CoberturaOut,
    PaginatedAdminUsers,
    AcessoOut,
    AcessosOut,
    PendenciasAdminOut,
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
    bloqueado: bool = Query(False, description="Só contas com login bloqueado agora"),
    orgao_id: int | None = Query(None, description="Órgão (SIORG), resolvido como nas estatísticas"),
    tema_id: int | None = Query(None, description="Tem este tema do catálogo"),
    nivel: NivelFormacao | None = Query(None, description="Formação mais alta neste nível"),
    turma: str | None = Query(None, description="Turma de ingresso; 'nenhuma' = não informada"),
    sem: str | None = Query(None, description="Perfil sem este item (foto, tema, formacao, pode_ajudar, links, lotacao, contato)"),
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

    if bloqueado:
        query = query.filter(Analista.login_bloqueado_ate > datetime.now(timezone.utc))

    if tema_id is not None:
        query = query.filter(Analista.temas.any(TemaAtuacao.tema_id == tema_id))

    if turma == "nenhuma":
        query = query.filter(Analista.turma.is_(None))
    elif turma:
        query = query.filter(Analista.turma == turma)

    # Os filtros que vêm dos gráficos das estatísticas usam as mesmas funções de lá (estatisticas.py),
    # para a lista aberta pelo clique ter exatamente o número mostrado no gráfico.
    testes = []
    if sem:
        if sem not in estatisticas.ITENS_PERFIL:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Item de perfil inválido")
        testes.append(lambda a: not estatisticas.tem_item(a, sem))
    if nivel is not None:
        rotulo = dict(estatisticas.NIVEIS)[nivel]
        testes.append(lambda a: estatisticas.nivel_mais_alto(a) == rotulo)
    if orgao_id is not None:
        resolvedor = estatisticas.ResolvedorOrgao(db)
        testes.append(lambda a: resolvedor.orgao_id(a) == orgao_id)
    if testes:
        candidatos = query.options(selectinload(Analista.temas), selectinload(Analista.formacoes)).all()
        query = db.query(Analista).filter(Analista.id.in_([a.id for a in candidatos if all(t(a) for t in testes)]))

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

    aprovou = updates.get('ativo') is True and analista.pendente_revisao
    if aprovou:
        _confirmar_vinculo_manual(analista)

    db.commit()
    db.refresh(analista)

    if ativou_conta:
        background_tasks.add_task(enviar_email_conta_ativada, analista.email_pessoal, analista.nome)
    if aprovou:
        background_tasks.add_task(completar_pelo_portal, analista.id)

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
    aprovou = analista.pendente_revisao
    if aprovou:
        _confirmar_vinculo_manual(analista)
    analista.ativo = True
    db.commit()
    db.refresh(analista)

    if ativou_conta:
        background_tasks.add_task(enviar_email_conta_ativada, analista.email_pessoal, analista.nome)
    if aprovou:
        background_tasks.add_task(completar_pelo_portal, analista.id)

    return analista


@router.get("/stats")
def get_stats(
    dias: int = Query(30, description="Tamanho do período: 7, 30 ou 90 dias; 0 = desde o início"),
    db: Session = Depends(get_db),
    _: Analista = Depends(get_current_admin),
):
    """Estatísticas do painel (só contas ativas). Ver estatisticas.py para as regras."""
    if dias not in (0, 7, 30, 90):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Período inválido")
    return estatisticas.estatisticas(db, dias)


@router.get("/pendencias", response_model=PendenciasAdminOut)
def get_pendencias(db: Session = Depends(get_db), _: Analista = Depends(get_current_admin)):
    """O que espera uma ação do admin (contadores do menu e do topo das estatísticas)."""
    return estatisticas.pendencias(db)


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
    background_tasks: BackgroundTasks,
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
    background_tasks.add_task(completar_pelo_portal, analista.id)
    return analista


@router.get("/cobertura", response_model=CoberturaOut)
def cobertura(db: Session = Depends(get_db), _: Analista = Depends(get_current_admin)):
    """Quantos ATPS de cada órgão têm conta ativa na Rede, comparado ao universo da cópia local
    da base do Portal (ATPS ativos por órgão de exercício)."""
    resolvedor = estatisticas.ResolvedorOrgao(db)

    universo: dict[int | None, int] = {}
    for orgao_id, n in db.execute(select(BaseAtps.orgao_siorg_id, func.count()).group_by(BaseAtps.orgao_siorg_id)):
        chave = orgao_id if orgao_id in resolvedor.orgaos else None
        universo[chave] = universo.get(chave, 0) + n
    referencia = db.scalar(select(func.max(BaseAtps.referencia)))

    rede: dict[int | None, int] = {}
    membros = db.query(Analista).filter(Analista.ativo.is_(True)).all()
    for a in membros:
        orgao_id = resolvedor.orgao_id(a)
        rede[orgao_id] = rede.get(orgao_id, 0) + 1

    linhas = []
    for orgao_id in (set(universo) | set(rede)) - {None}:
        o = resolvedor.orgaos[orgao_id]
        linhas.append({"orgao_id": o.id, "nome": o.nome, "sigla": o.sigla,
                       "universo": universo.get(orgao_id, 0), "rede": rede.get(orgao_id, 0)})
    linhas.sort(key=lambda l: (-l["universo"], -l["rede"], l["nome"]))

    return CoberturaOut(
        referencia=referencia,
        total_universo=sum(universo.values()),
        total_rede=len(membros),
        orgaos=linhas,
        sem_orgao_universo=universo.get(None, 0),
        sem_orgao_rede=rede.get(None, 0),
    )


# --- Log de acessos (só admin; a ANDEPS não vê) ---

def get_admin_estrito(analista: Analista = Depends(get_current_admin)) -> Analista:
    if analista.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito à administração")
    return analista


@router.get("/acessos", response_model=AcessosOut)
def log_acessos(
    limite: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Filtra pelo nome da pessoa"),
    db: Session = Depends(get_db),
    _: Analista = Depends(get_admin_estrito),
):
    """Últimos acessos, do mais recente ao mais antigo: uma linha por sessão do navegador em que a
    pessoa abriu a Rede logada."""
    from models import Acesso
    consulta = (db.query(Acesso, Analista).outerjoin(Analista, Analista.id == Acesso.analista_id)
                .filter(Acesso.tipo == "rede"))
    if q and q.strip():
        consulta = consulta.filter(func.f_unaccent(func.lower(Analista.nome)).like(func.f_unaccent(func.lower(f"%{q.strip()}%"))))
    total = consulta.count()
    linhas = consulta.order_by(Acesso.criado_em.desc(), Acesso.id.desc()).offset(offset).limit(limite).all()
    return AcessosOut(total=total, itens=[
        AcessoOut(
            id=ac.id, quando=ac.criado_em, tipo=ac.tipo,
            analista_id=a.id if a else None, nome=a.nome if a else None,
            orgao=(a.ministerio_sigla or a.ministerio) if a else None,
            excluida=a is None,
        )
        for ac, a in linhas
    ])
