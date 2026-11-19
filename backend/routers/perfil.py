import io
import os
import uuid
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File, status
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import func, null, or_, select
from sqlalchemy.orm import Session
from database import get_db
from models import (
    AcaoConsentimento, Analista, ConflitoCadastro, Formacao, Tema, TemaAtuacao, UnidadeSiorg,
    condicao_perfil_visivel,
)
from schemas import (
    AnalistaOut, AnalistaUpdate, AnalistaPublico,
    ConsentimentoOut,
    ExcluirContaIn,
    FormacaoBase, FormacaoOut,
    LotacaoComumOut, LotacaoOut, ProximoOut,
    RegularizarIn,
    SugestaoIn,
    TemaCatalogoOut, TemaCreate, TemaOut, TemaSugestaoOut,
)
from auth import get_current_user, get_usuario_regular, verify_password
import atualizacao
import catalogo_temas
import lotacao_auto
import lotacao_siorg
import novidades
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
# Três tamanhos: a foto completa só é baixada quando alguém amplia
DIMENSAO_MAXIMA_PX = 1600  # completa (ampliação)
MEDIA_PX = 480  # topo do perfil (200 px em tela 2x)
MINIATURA_PX = 240  # cards, listas, topo da busca (120 px em tela 2x)
VARIANTES = {"_m": MEDIA_PX, "_p": MINIATURA_PX}
EXTENSOES_SERVIDAS = {".jpg", ".jpeg", ".png", ".webp"}

# Protege contra "bombas de descompressão" (imagens pequenas em bytes e enormes em pixels).
Image.MAX_IMAGE_PIXELS = 40_000_000


def caminho_variante(foto_path: str, sufixo: str) -> str:
    return f"{os.path.splitext(foto_path)[0]}{sufixo}.jpg"


def gravar_variantes(img: Image.Image, foto_path: str) -> None:
    """Versões menores ao lado da foto: _m (480 px) e _p (240 px)."""
    for sufixo, lado in VARIANTES.items():
        menor = img.copy()
        menor.thumbnail((lado, lado))
        menor.save(caminho_variante(foto_path, sufixo), "JPEG", quality=80, optimize=True, progressive=True)


def salvar_foto(img: Image.Image) -> str:
    """Grava a foto (até 1600 px) e as versões de 480 e 240 px em JPEG progressivo, sem
    metadados. Devolve o caminho da foto completa."""
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((DIMENSAO_MAXIMA_PX, DIMENSAO_MAXIMA_PX))
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    caminho = f"{UPLOAD_DIR}/{uuid.uuid4()}.jpg"
    img.save(caminho, "JPEG", quality=82, optimize=True, progressive=True)
    gravar_variantes(img, caminho)
    return caminho


def remover_foto(foto_path: str | None) -> None:
    if not foto_path:
        return
    for caminho in (foto_path, *(caminho_variante(foto_path, s) for s in VARIANTES)):
        if os.path.exists(caminho):
            os.remove(caminho)


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

    lotacao_antes = novidades.foto_lotacao(analista)
    cargo_antes, turma_antes = analista.cargo_fce, analista.turma
    for field, value in updates.items():
        if field in AUTORIZACOES_EXIBICAO:
            if value is None:
                continue
            if value != getattr(analista, field):
                tipo, valor_exibir = AUTORIZACOES_EXIBICAO[field]
                acao = AcaoConsentimento.aceito if value == valor_exibir else AcaoConsentimento.revogado
                registrar(analista, tipo, acao, request)
        setattr(analista, field, value)
    # O titular mexeu no que veio do Portal: deixa de ser "preenchido automaticamente",
    # e uma sugestão de atualização pendente perde o sentido.
    if novidades.foto_lotacao(analista) != lotacao_antes:
        analista.lotacao_origem = None
        analista.lotacao_siorg_id = lotacao_siorg.resolver(db, analista)
        atualizacao.limpar(analista)
    if analista.cargo_fce != cargo_antes:
        analista.cargo_origem = None
        atualizacao.limpar(analista)
    if analista.turma != turma_antes:
        analista.turma_origem = None
    novidades.registrar_lotacao(db, analista, lotacao_antes)
    db.commit()
    db.refresh(analista)
    return analista


@router.post("/perfil/sugestao", response_model=AnalistaOut)
def responder_sugestao(
    body: SugestaoIn,
    analista: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    """Aceita ou descarta a sugestão de atualização vinda do Portal."""
    if body.aceitar:
        atualizacao.aceitar(db, analista)
    else:
        atualizacao.descartar(analista)
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
    resultado = None

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

    # Lotação em branco e Autorização v2 aceita: preenche com o exercício do Portal.
    # Quem já tinha CPF guardado e só aceitou os termos agora ganha uma consulta para isso.
    if lotacao_auto.pode_preencher(analista):
        if resultado is None and analista.cpf_cifrado:
            resultado = consultar_situacao_atps(decifrar_cpf(analista.cpf_cifrado), None)
        if resultado is not None and resultado.confirmado:
            lotacao_auto.preencher(db, analista, resultado.exercicio)
    if resultado is not None and resultado.confirmado:
        atualizacao.registrar(db, analista, resultado.exercicio)

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
    # códigos SIORG de cada nível da lotação, para ligar às páginas de unidade
    ids = [u.id for u in lotacao_siorg.caminho(db, analista.lotacao_siorg_id)]
    return result.model_copy(update={"lotacao_ids": ids})


# Proximidade na lotação: vale o nível mais fundo em comum. Ordena antes dos temas.
PONTOS_LOTACAO = {"ministerio": 1, "secretaria": 2, "departamento": 3, "coordenacao_geral": 4, "coordenacao": 5}


def _chave(texto: str | None) -> str:
    return " ".join((texto or "").casefold().split())


def _lotacao_comum(a: Analista, b: Analista) -> tuple[str, str] | None:
    """Nível mais fundo em que as lotações coincidem, descendo do ministério."""
    comum = None
    for nivel in PONTOS_LOTACAO:
        va, vb = _chave(getattr(a, nivel)), _chave(getattr(b, nivel))
        if not va or va != vb:
            break
        comum = (nivel, getattr(a, nivel).strip())
    return comum


@router.get("/analistas/{analista_id}/proximos", response_model=list[ProximoOut])
def pessoas_proximas(
    analista_id: int,
    limite: int = 4,
    db: Session = Depends(get_db),
    eu: Analista = Depends(get_usuario_regular),
):
    """Pessoas próximas de um perfil. Primeiro quem está mais perto na lotação (mesma
    coordenação > coordenação-geral > departamento > secretaria > ministério); os temas de
    atuação em comum desempatam e completam a lista com quem é de fora.
    Não inclui quem está olhando, não depende dos favoritos de ninguém e a ordem é estável."""
    from routers.busca import _aplicar_visibilidade

    alvo = db.get(Analista, analista_id)
    if alvo is None or not alvo.perfil_visivel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista não encontrado")
    temas_alvo = {_chave(t.tema): t.tema.strip() for t in alvo.temas}

    filtros = []
    if temas_alvo:
        filtros.append(Analista.temas.any(func.lower(func.trim(TemaAtuacao.tema)).in_(list(temas_alvo))))
    if _chave(alvo.ministerio):
        filtros.append(func.lower(func.trim(Analista.ministerio)) == _chave(alvo.ministerio))
    if not filtros:
        return []
    candidatos = (
        db.query(Analista)
        .filter(condicao_perfil_visivel(), Analista.id.notin_([alvo.id, eu.id]), or_(*filtros))
        .all()
    )

    pontuados = []
    for c in candidatos:
        comuns = sorted({temas_alvo[k] for k in (_chave(t.tema) for t in c.temas) if k in temas_alvo})
        lot = _lotacao_comum(alvo, c)
        nivel = PONTOS_LOTACAO[lot[0]] if lot else 0
        if nivel or comuns:
            # desempate final fixo e sem favorecer contas antigas ou novas
            pontuados.append((-nivel, -len(comuns), (c.id * 7919) % 10007, c, comuns, lot))
    pontuados.sort(key=lambda x: x[:3])
    return [
        ProximoOut(
            analista=_aplicar_visibilidade(c),
            temas_comuns=comuns,
            lotacao_comum=LotacaoComumOut(nivel=lot[0], nome=lot[1]) if lot else None,
        )
        for *_, c, comuns, lot in pontuados[: max(1, min(limite, 12))]
    ]


# --- Formações ---

@router.post("/perfil/formacao", response_model=FormacaoOut, status_code=status.HTTP_201_CREATED)
def add_formacao(
    body: FormacaoBase,
    analista: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    formacao = Formacao(analista_id=analista.id, **body.model_dump())
    db.add(formacao)
    db.flush()
    novidades.registrar_formacao(db, formacao)
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
    novidades.remover_item(db, "formacao", formacao.id)
    db.delete(formacao)
    db.commit()


# --- Temas de atuação ---

def _sugestao(t: Tema, total: int, apelido: str | None = None) -> dict:
    return {"id": t.id, "nome": t.nome, "tipo": t.tipo, "total": total, "apelido": apelido}


@router.post("/perfil/tema", response_model=TemaOut, status_code=status.HTTP_201_CREATED)
def add_tema(
    body: TemaCreate,
    analista: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    """Inclui um tema do catálogo no perfil. Nome digitado que já existe (nome oficial, sigla ou
    apelido) usa o tema existente; nome que nunca foi usado só vira tema novo com confirmação —
    sem ela, 409 com os temas parecidos (o atrito para não espalhar variações)."""
    if body.tema_id is not None:
        cat = db.get(Tema, body.tema_id)
        if cat is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tema não encontrado.")
    else:
        nome = catalogo_temas.normalizar(body.tema or "")
        if len(nome) < 2:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Digite o nome do tema.")
        cat = catalogo_temas.achar_exato(db, nome)
        if cat is None:
            if not body.confirmar_novo:
                totais = catalogo_temas.totais(db)
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={
                    "codigo": "tema_novo",
                    "nome": nome,
                    "parecidos": [_sugestao(t, totais.get(t.id, 0)) for t, _ in catalogo_temas.parecidos(db, nome)],
                })
            cat = Tema(nome=nome, tipo=body.tipo, revisado=False, criado_por_id=analista.id)
            db.add(cat)
            db.flush()

    if any(t.tema_id == cat.id for t in analista.temas):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esse tema já está no seu perfil.")
    if sum(1 for t in analista.temas if t.tipo == cat.tipo) >= catalogo_temas.MAX_POR_TIPO:
        grupo = "áreas de política" if cat.tipo == "area" else "ferramentas e métodos"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Você já tem {catalogo_temas.MAX_POR_TIPO} {grupo}. Remova um para incluir outro.")

    tema = TemaAtuacao(analista_id=analista.id, tema=cat.nome, tema_id=cat.id, em_exercicio_atual=body.em_exercicio_atual)
    tema.catalogo = cat
    db.add(tema)
    db.flush()
    novidades.registrar_tema(db, tema)
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
    novidades.remover_item(db, "tema", tema.id)
    db.delete(tema)
    db.commit()


@router.get("/perfil/temas/sugestoes", response_model=list[TemaSugestaoOut])
def sugestoes_temas(
    q: str = "",
    tipo: str | None = None,
    limite: int = 10,
    _: Analista = Depends(get_usuario_regular),
    db: Session = Depends(get_db),
):
    """Temas do catálogo que combinam com o que está sendo digitado (aceita sigla, apelido, palavra
    pela metade e erro de digitação), dos mais usados para os menos. Sem texto: os mais usados."""
    totais = catalogo_temas.totais(db)
    achados = []
    for t in db.scalars(select(Tema)):
        if tipo and t.tipo != tipo:
            continue
        nota = catalogo_temas.pontuacao_busca(q, t)
        if nota <= 0:
            continue
        apelido = None
        if q.strip() and catalogo_temas.chave(q) not in catalogo_temas.chave(t.nome):
            kq = catalogo_temas.chave(q)
            apelido = next((a for a in t.lista_apelidos if kq in catalogo_temas.chave(a)), None)
        achados.append((nota, totais.get(t.id, 0), t, apelido))
    achados.sort(key=lambda x: (-x[0], -x[1], x[2].nome))
    return [_sugestao(t, n, apelido) for _, n, t, apelido in achados[: max(1, min(limite, 30))]]


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
            filepath = salvar_foto(img)
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
        # sem cache: o Cloudflare guardaria o "não encontrado" de uma versão que ainda vai existir
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto não encontrada",
                            headers={"Cache-Control": "no-store"})
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
    oficial: bool = False,
    db: Session = Depends(get_db),
    _: Analista = Depends(get_usuario_regular),
):
    """Lotações de um nível, filtradas pelos nomes completos dos níveis acima.

    oficial=false (filtro da busca): só o que já está nos perfis visíveis.
    oficial=true (edição do perfil): a estrutura oficial do SIORG naquele ponto da árvore,
    mais o que já foi digitado nos perfis e não existe no SIORG. `total` = perfis visíveis."""
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
    acima = ordem[: ordem.index(nivel)]
    for n in acima:
        if filtros[n]:
            stmt = stmt.where(NIVEIS_LOTACAO[n][0] == filtros[n])
    dos_perfis = [LotacaoOut(nome=n, sigla=s, total=t) for n, s, t in db.execute(stmt)]
    if not oficial:
        return dos_perfis

    oficiais = _unidades_siorg(db, [filtros[n] for n in acima])
    if oficiais is None:  # SIORG ainda não sincronizado ou caminho fora da estrutura oficial
        return dos_perfis
    totais = {l.nome: l.total for l in dos_perfis}
    resultado = {u.nome: LotacaoOut(nome=u.nome, sigla=u.sigla if col_sigla is not None else None,
                                    total=totais.get(u.nome, 0)) for u in oficiais}
    for l in dos_perfis:
        resultado.setdefault(l.nome, l)
    return sorted(resultado.values(), key=lambda l: l.nome.casefold())


def _unidades_siorg(db: Session, caminho: list[str | None]) -> list[UnidadeSiorg] | None:
    """Filhas, no SIORG, da unidade apontada pelo caminho de nomes acima (vazio = órgãos)."""
    if not caminho:
        unidades = db.scalars(select(UnidadeSiorg).where(UnidadeSiorg.profundidade == 0)).all()
        return list(unidades) or None
    pai_id = None
    for profundidade, nome in enumerate(caminho):
        if not nome:
            return None
        cond = [UnidadeSiorg.profundidade == profundidade, UnidadeSiorg.nome == nome]
        if pai_id is not None:
            cond.append(UnidadeSiorg.pai_id == pai_id)
        achadas = db.scalars(select(UnidadeSiorg).where(*cond)).all()
        if len(achadas) != 1:
            return None
        pai_id = achadas[0].id
    return list(db.scalars(select(UnidadeSiorg).where(UnidadeSiorg.pai_id == pai_id)))


@router.get("/temas", response_model=list[TemaCatalogoOut])
def listar_temas(db: Session = Depends(get_db), _: Analista = Depends(get_usuario_regular)):
    """Todos os temas de atuação dos perfis visíveis, do mais citado ao menos citado."""
    total = func.count(func.distinct(TemaAtuacao.analista_id))
    stmt = (
        select(TemaAtuacao.tema, func.coalesce(Tema.tipo, "area"), total)
        .join(Analista, Analista.id == TemaAtuacao.analista_id)
        .outerjoin(Tema, Tema.id == TemaAtuacao.tema_id)
        .where(condicao_perfil_visivel())
        .group_by(TemaAtuacao.tema, Tema.tipo)
        .order_by(total.desc(), TemaAtuacao.tema)
    )
    return [TemaCatalogoOut(tema=t, tipo=tp, total=n) for t, tp, n in db.execute(stmt)]
