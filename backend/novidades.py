"""Novidades de perfil para quem favoritou a pessoa.

Só três mudanças viram novidade — as que importam para quem quer contatar alguém:
mudança de lotação, novo tema de atuação e nova formação. Foto, textos e links não.

Quem favoritou vê as novidades ocorridas depois do favorito (ou da última visita ao
perfil) e só enquanto o perfil estiver visível. Quem é favoritado não sabe quem o segue.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from models import Analista, EventoPerfil, Favorito, Formacao, TemaAtuacao, condicao_perfil_visivel

from documentos_legais import RETENCAO_NOVIDADES_DIAS as RETENCAO_DIAS  # citado no termo
# Várias gravações seguidas da lotação (pessoa ajustando o formulário) viram uma novidade só.
JANELA_AGRUPAR = timedelta(hours=24)

CAMPOS_LOTACAO = (
    ("ministerio", "ministerio_sigla"),
    ("secretaria", "secretaria_sigla"),
    ("departamento", "departamento_sigla"),
    ("coordenacao_geral", None),
    ("coordenacao", None),
)
NOMES_NIVEL = {
    "graduacao": "Graduação",
    "especializacao": "Especialização",
    "mestrado": "Mestrado",
    "doutorado": "Doutorado",
    "pos_doutorado": "Pós-doutorado",
}


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def foto_lotacao(a: Analista) -> tuple:
    """Estado atual da lotação, para comparar antes e depois de uma edição."""
    return tuple(
        (getattr(a, nome) or "").strip() + "|" + ((getattr(a, sigla) or "").strip() if sigla else "")
        for nome, sigla in CAMPOS_LOTACAO
    )


def _descrever_lotacao(a: Analista) -> str:
    partes = []
    for nome, sigla in CAMPOS_LOTACAO:
        valor = (getattr(a, sigla) if sigla else None) or getattr(a, nome)
        if valor and valor.strip():
            partes.append(valor.strip())
    return " › ".join(partes)[:500]


def registrar_lotacao(db: Session, a: Analista, antes: tuple) -> None:
    """Chamar depois de aplicar a edição e antes do commit."""
    if foto_lotacao(a) == antes:
        return
    descricao = _descrever_lotacao(a)
    recente = db.scalars(
        select(EventoPerfil)
        .where(
            EventoPerfil.analista_id == a.id,
            EventoPerfil.tipo == "lotacao",
            EventoPerfil.criado_em > _agora() - JANELA_AGRUPAR,
        )
        .order_by(EventoPerfil.criado_em.desc())
    ).first()
    if not descricao:  # apagou a lotação: não é novidade, e a anterior perde o sentido
        if recente:
            db.delete(recente)
        return
    if recente:
        recente.descricao = descricao
        recente.criado_em = _agora()
    else:
        db.add(EventoPerfil(analista_id=a.id, tipo="lotacao", descricao=descricao))


def registrar_tema(db: Session, tema: TemaAtuacao) -> None:
    """Chamar depois do flush (o tema precisa ter id). Experiência anterior não é novidade."""
    if not tema.em_exercicio_atual:
        return
    db.add(EventoPerfil(analista_id=tema.analista_id, tipo="tema", ref_id=tema.id, descricao=tema.tema[:500]))


def registrar_formacao(db: Session, f: Formacao) -> None:
    nivel = NOMES_NIVEL.get(getattr(f.nivel, "value", f.nivel), "Formação")
    descricao = f"{nivel} em {f.curso} — {f.instituicao}"[:500]
    db.add(EventoPerfil(analista_id=f.analista_id, tipo="formacao", ref_id=f.id, descricao=descricao))


def remover_item(db: Session, tipo: str, ref_id: int) -> None:
    db.execute(delete(EventoPerfil).where(EventoPerfil.tipo == tipo, EventoPerfil.ref_id == ref_id))


def condicao_novidade():
    """Evento novo para o favorito: depois do favorito/última visita e dentro da retenção.
    Usar com EventoPerfil e Favorito na consulta."""
    return (
        EventoPerfil.analista_id == Favorito.favorito_id,
        EventoPerfil.criado_em > func.coalesce(Favorito.visto_em, Favorito.criado_em),
        EventoPerfil.criado_em > _agora() - timedelta(days=RETENCAO_DIAS),
    )


def novidades_de(db: Session, eu_id: int) -> dict[int, list[EventoPerfil]]:
    """{id do favorito: eventos novos, do mais recente ao mais antigo}, só perfis visíveis."""
    stmt = (
        select(EventoPerfil)
        .join(Favorito, Favorito.analista_id == eu_id)
        .join(Analista, Analista.id == EventoPerfil.analista_id)
        .where(*condicao_novidade(), condicao_perfil_visivel())
        .order_by(EventoPerfil.criado_em.desc(), EventoPerfil.id.desc())
    )
    resultado: dict[int, list[EventoPerfil]] = {}
    for evento in db.scalars(stmt):
        resultado.setdefault(evento.analista_id, []).append(evento)
    return resultado


def apagar_antigas(db: Session, agora: datetime) -> int:
    r = db.execute(delete(EventoPerfil).where(EventoPerfil.criado_em < agora - timedelta(days=RETENCAO_DIAS)))
    db.commit()
    return r.rowcount or 0
