import io
import os
import uuid
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File, status
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import func, null, select
from sqlalchemy.orm import Session
from database import get_db
from models import (
    AcaoConsentimento, Analista, ConflitoCadastro, Formacao, TemaAtuacao, condicao_perfil_visivel,
)
from schemas import (
    AnalistaOut, AnalistaUpdate, AnalistaPublico,
    ConsentimentoOut,
    ExcluirContaIn,
    FormacaoBase, FormacaoOut,
    LotacaoOut,
    RegularizarIn,
    TemaBase, TemaCatalogoOut, TemaOut,
)
from auth import get_current_user, get_usuario_regular, verify_password
from consentimentos import (
    EXIBIR_CELULAR, EXIBIR_EMAIL_PESSOAL, EXIBIR_PERFIL,
    registrar, registrar_aceite_obrigatorios, validar_versoes,
)
from cpf_utils import cifrar_cpf, decifrar_cpf, hash_cpf, limpar_cpf
from email_utils import enviar_email_alerta_cpf_em_uso
from portal_transparencia import StatusVerificacao, consultar_situacao_atps

router = APIRouter(tags=["perfil"])

UPLOAD_DIR = "uploads/fotos"
FORMATOS_ACEITOS = {"JPEG", "PNG", "WEBP"}
TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024
DIMENSAO_MAXIMA_PX = 800
EXTENSOES_SERVIDAS = {".jpg", ".jpeg", ".png", ".webp"}

# Protege contra "bombas de descompressão" (imagens pequenas em bytes e enormes em pixels).
Image.MAX_IMAGE_PIXELS = 40_000_000


def remover_foto(foto_path: str | None) -> None:
    if foto_path and os.path.exists(foto_path):
        os.remove(foto_path)


# --- Perfil próprio ---

@router.get("/perfil/me", response_model=AnalistaOut)
def get_meu_perfil(analista: Analista = Depends(get_current_user)):
    return analista


# Campos de exibição que são autorizações do titular: cada mudança é registrada
# como aceite/revogação. (tipo do consentimento, valor do campo que significa "exibir")
AUTORIZACOES_EXIBICAO = {
    "visibilidade_email_pessoal": (EXIBIR_EMAIL_PESSOAL, True),
    "visibilidade_celular": (EXIBIR_CELULAR, True),
    "perfil_oculto": (EXIBIR_PERFIL, False),
}


def _verificar_novo_nome(analista: Analista, novo_nome: str) -> None:
    """Sem isso, bastaria trocar o nome depois do cadastro para escapar da
    comparação com o nome registrado no Portal da Transparência."""
    resultado = consultar_situacao_atps(decifrar_cpf(analista.cpf_cifrado), novo_nome)
    if resultado.status == StatusVerificacao.inconclusivo:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível conferir o novo nome no Portal da Transparência agora. Tente novamente mais tarde.",
        )
    if resultado.status == StatusVerificacao.nome_divergente or (
        resultado.status == StatusVerificacao.nao_encontrado and not analista.vinculo_manual
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O nome informado não confere com o nome registrado no Portal da Transparência para o seu CPF.",
        )


@router.put("/perfil/me", response_model=AnalistaOut)
def update_meu_perfil(
    body: AnalistaUpdate,
    request: Request,
    analista: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    updates = body.model_dump(exclude_unset=True)
    novo_nome = updates.get("nome")
    if novo_nome is not None and novo_nome.strip() != analista.nome.strip():
        _verificar_novo_nome(analista, novo_nome)

    for field, value in updates.items():
        if field in AUTORIZACOES_EXIBICAO:
            if value is None:
                continue
            if value != getattr(analista, field):
                tipo, valor_exibir = AUTORIZACOES_EXIBICAO[field]
                acao = AcaoConsentimento.aceito if value == valor_exibir else AcaoConsentimento.revogado
                registrar(analista, tipo, acao, request)
        setattr(analista, field, value)
    db.commit()
    db.refresh(analista)
    return analista


@router.post("/perfil/regularizar", response_model=AnalistaOut)
def regularizar(
    body: RegularizarIn,
    request: Request,
    background_tasks: BackgroundTasks,
    analista: Analista = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Atualização cadastral exigida no login: informar o CPF (contas anteriores à
    criptografia do CPF) e/ou aceitar a versão atual dos documentos obrigatórios."""
    pendencias = analista.pendencias

    if "termos" in pendencias:
        if not (body.aceite_termos and body.aceite_consulta_cpf):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="É necessário aceitar o Termo de Consentimento e autorizar a consulta do CPF.",
            )
        validar_versoes(body.versoes)

    if "cpf" in pendencias:
        if not body.cpf:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe seu CPF.")
        cpf_limpo = limpar_cpf(body.cpf)
        cpf_hash_valor = hash_cpf(cpf_limpo)

        if analista.cpf_hash and analista.cpf_hash != cpf_hash_valor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O CPF informado não confere com o CPF usado no seu cadastro.",
            )
        if not analista.cpf_hash:
            outro = db.query(Analista).filter(
                Analista.cpf_hash == cpf_hash_valor, Analista.id != analista.id,
            ).first()
            if outro:
                db.add(ConflitoCadastro(
                    analista_id=outro.id,
                    nome_informado=analista.nome,
                    email_informado=analista.email_pessoal,
                ))
                db.commit()
                background_tasks.add_task(enviar_email_alerta_cpf_em_uso, outro.email_pessoal, outro.nome)
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Este CPF já está vinculado a outra conta. A situação foi encaminhada para análise de um administrador.",
                )

        resultado = consultar_situacao_atps(cpf_limpo, analista.nome)
        analista.cpf_hash = cpf_hash_valor
        analista.cpf_cifrado = cifrar_cpf(cpf_limpo)
        if resultado.confirmado:
            analista.cpf_verificado_em = datetime.now(timezone.utc)
            analista.vinculo_manual = False
            analista.motivo_pendencia = None
        elif resultado.status != StatusVerificacao.inconclusivo:
            # Conta já existente: não é bloqueada aqui — o administrador é alertado.
            analista.motivo_pendencia = f"Atualização cadastral: {resultado.motivo}"

    if "termos" in pendencias:
        registrar_aceite_obrigatorios(analista, request)

    db.commit()
    db.refresh(analista)
    return analista


@router.get("/perfil/privacidade", response_model=list[ConsentimentoOut])
def minhas_autorizacoes(analista: Analista = Depends(get_current_user)):
    """Histórico de aceites e revogações do titular."""
    return analista.consentimentos


@router.delete("/perfil/me", status_code=status.HTTP_204_NO_CONTENT)
def excluir_minha_conta(
    body: ExcluirContaIn,
    analista: Analista = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Exclusão definitiva da conta e de todos os dados pessoais, conforme LGPD."""
    if not verify_password(body.senha, analista.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Senha incorreta")

    remover_foto(analista.foto_path)

    db.delete(analista)
    db.commit()


# --- Perfil público de outro analista ---

@router.get("/analistas/{analista_id}", response_model=AnalistaPublico)
def get_analista(
    analista_id: int,
    db: Session = Depends(get_db),
    _: Analista = Depends(get_usuario_regular),
):
    analista = db.get(Analista, analista_id)
    if analista is None or not analista.perfil_visivel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista não encontrado")
    result = AnalistaPublico.model_validate(analista)
    if not analista.visibilidade_email_pessoal:
        result = result.model_copy(update={"email_pessoal": None})
    if not analista.visibilidade_celular:
        result = result.model_copy(update={"celular": None})
    return result


# --- Formações ---

@router.post("/perfil/formacao", response_model=FormacaoOut, status_code=status.HTTP_201_CREATED)
def add_formacao(
    body: FormacaoBase,
    analista: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    formacao = Formacao(analista_id=analista.id, **body.model_dump())
    db.add(formacao)
    db.commit()
    db.refresh(formacao)
    return formacao


@router.delete("/perfil/formacao/{formacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_formacao(
    formacao_id: int,
    analista: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    formacao = db.get(Formacao, formacao_id)
    if formacao is None or formacao.analista_id != analista.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formação não encontrada")
    db.delete(formacao)
    db.commit()


# --- Temas de atuação ---

@router.post("/perfil/tema", response_model=TemaOut, status_code=status.HTTP_201_CREATED)
def add_tema(
    body: TemaBase,
    analista: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    tema = TemaAtuacao(analista_id=analista.id, **body.model_dump())
    db.add(tema)
    db.commit()
    db.refresh(tema)
    return tema


@router.delete("/perfil/tema/{tema_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tema(
    tema_id: int,
    analista: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    tema = db.get(TemaAtuacao, tema_id)
    if tema is None or tema.analista_id != analista.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tema não encontrado")
    db.delete(tema)
    db.commit()


@router.get("/perfil/temas/sugestoes", response_model=list[str])
def sugestoes_temas(
    q: str = "",
    _: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    from sqlalchemy import select, func
    stmt = (
        select(TemaAtuacao.tema)
        .where(TemaAtuacao.tema.ilike(f"%{q}%"))
        .group_by(TemaAtuacao.tema)
        .order_by(func.count().desc(), TemaAtuacao.tema)
        .limit(8)
    )
    return list(db.scalars(stmt))


# --- Foto de perfil ---

@router.post("/perfil/foto", response_model=AnalistaOut)
def upload_foto(
    file: UploadFile = File(...),
    analista: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    formato_invalido = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Formato inválido. Use uma imagem JPEG, PNG ou WebP de até 5 MB.",
    )
    conteudo = file.file.read(TAMANHO_MAXIMO_BYTES + 1)
    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise formato_invalido

    # O tipo é determinado pelo conteúdo real do arquivo, não pelo nome nem pelo
    # Content-Type enviados. A imagem é sempre reencodada como JPEG: isso descarta
    # qualquer conteúdo embutido e os metadados (EXIF, inclusive localização GPS).
    try:
        with Image.open(io.BytesIO(conteudo)) as img:
            if img.format not in FORMATOS_ACEITOS:
                raise formato_invalido
            img = ImageOps.exif_transpose(img).convert("RGB")
            img.thumbnail((DIMENSAO_MAXIMA_PX, DIMENSAO_MAXIMA_PX))
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            filepath = f"{UPLOAD_DIR}/{uuid.uuid4()}.jpg"
            img.save(filepath, "JPEG", quality=85)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError):
        raise formato_invalido

    remover_foto(analista.foto_path)

    analista.foto_path = filepath
    db.commit()
    db.refresh(analista)
    return analista


@router.delete("/perfil/foto", response_model=AnalistaOut)
def remover_minha_foto(
    analista: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    remover_foto(analista.foto_path)
    analista.foto_path = None
    db.commit()
    db.refresh(analista)
    return analista


@router.get("/uploads/fotos/{nome_arquivo}")
def servir_foto(nome_arquivo: str, _: Analista = Depends(get_usuario_regular)):
    """Fotos só são servidas a usuários logados (antes ficavam em diretório público)."""
    nome = os.path.basename(nome_arquivo)
    caminho = f"{UPLOAD_DIR}/{nome}"
    if nome != nome_arquivo or os.path.splitext(nome)[1].lower() not in EXTENSOES_SERVIDAS or not os.path.isfile(caminho):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto não encontrada")
    return FileResponse(
        caminho,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"},
    )


# --- Listas para filtros e edição ---

# Níveis da lotação, de cima para baixo: (coluna do nome, coluna da sigla)
NIVEIS_LOTACAO = {
    "ministerio": (Analista.ministerio, Analista.ministerio_sigla),
    "secretaria": (Analista.secretaria, Analista.secretaria_sigla),
    "departamento": (Analista.departamento, Analista.departamento_sigla),
    "coordenacao_geral": (Analista.coordenacao_geral, None),
    "coordenacao": (Analista.coordenacao, None),
}


@router.get("/lotacoes", response_model=list[LotacaoOut])
def listar_lotacoes(
    nivel: Literal["ministerio", "secretaria", "departamento", "coordenacao_geral", "coordenacao"],
    ministerio: str | None = None,
    secretaria: str | None = None,
    departamento: str | None = None,
    coordenacao_geral: str | None = None,
    db: Session = Depends(get_db),
    _: Analista = Depends(get_usuario_regular),
):
    """Lotações já cadastradas nos perfis visíveis, para as listas encadeadas da edição
    e o filtro da busca. Cada nível é filtrado pelos nomes completos dos níveis acima."""
    col_nome, col_sigla = NIVEIS_LOTACAO[nivel]
    # Sigla mais alta em ordem alfabética quando o mesmo nome tem siglas diferentes
    sigla = func.max(col_sigla) if col_sigla is not None else null()
    stmt = (
        select(col_nome, sigla, func.count())
        .where(condicao_perfil_visivel(), col_nome.isnot(None), col_nome != "")
        .group_by(col_nome)
        .order_by(col_nome)
    )
    filtros = {
        "ministerio": ministerio, "secretaria": secretaria,
        "departamento": departamento, "coordenacao_geral": coordenacao_geral,
    }
    ordem = list(NIVEIS_LOTACAO)
    for acima in ordem[: ordem.index(nivel)]:
        if filtros[acima]:
            stmt = stmt.where(NIVEIS_LOTACAO[acima][0] == filtros[acima])
    return [LotacaoOut(nome=n, sigla=s, total=t) for n, s, t in db.execute(stmt)]


@router.get("/temas", response_model=list[TemaCatalogoOut])
def catalogo_temas(db: Session = Depends(get_db), _: Analista = Depends(get_usuario_regular)):
    """Todos os temas de atuação dos perfis visíveis, do mais citado ao menos citado."""
    total = func.count(func.distinct(TemaAtuacao.analista_id))
    stmt = (
        select(TemaAtuacao.tema, total)
        .join(Analista, Analista.id == TemaAtuacao.analista_id)
        .where(condicao_perfil_visivel())
        .group_by(TemaAtuacao.tema)
        .order_by(total.desc(), TemaAtuacao.tema)
    )
    return [TemaCatalogoOut(tema=t, total=n) for t, n in db.execute(stmt)]
