"""Perfil sempre atualizado: quando o Portal mostra outro exercício ou outra função
comissionada, o titular recebe uma sugestão para aceitar ou descartar. Nada muda sozinho.

Só com a Autorização de consulta do CPF na versão ampliada (VERSAO_AUTORIZACAO_AMPLIADA).
Uma sugestão descartada não volta, a menos que o Portal mostre outra mudança.
"""
import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

import lotacao_auto
import lotacao_siorg
from documentos_legais import VERSAO_AUTORIZACAO_AMPLIADA
from lotacao_auto import CAMPOS, cargo_equivale, cargo_vazio, normalizar
from models import Analista
from portal_transparencia import Exercicio


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def _dentro_da_presidencia(a: Analista, destino: list) -> bool:
    """No SIAPE, SECOM, Casa Civil, SG etc. aparecem só como "Presidência da República".
    Sem unidade que case, trocar o órgão do perfil pela PR só perderia informação."""
    return (
        len(destino) == 1
        and (destino[0].sigla or "").upper() == "PR"
        and "PRESIDENCIA DA REPUBLICA" in normalizar(a.ministerio or "")
    )


def calcular(db: Session, a: Analista, ex: Exercicio | None) -> dict | None:
    if ex is None or lotacao_auto.versao_autorizacao(a) < VERSAO_AUTORIZACAO_AMPLIADA:
        return None
    sugestao: dict = {}

    destino = lotacao_auto.caminho_para(db, ex)
    if destino and (a.ministerio or "").strip():  # lotação em branco é preenchida, não sugerida
        atual_ids = [u.id for u in lotacao_siorg.caminho(db, a.lotacao_siorg_id)]
        destino_ids = [u.id for u in destino]
        if atual_ids:
            # mesma unidade, ou o Portal só conhece um nível acima do que o perfil já detalha
            diferente = atual_ids[: len(destino_ids)] != destino_ids
        else:  # perfil fora da estrutura oficial: compara só o órgão
            diferente = normalizar(a.ministerio) != normalizar(destino[0].nome) and (
                normalizar(a.ministerio_sigla or "") != normalizar(destino[0].sigla or "")
            )
        if diferente and _dentro_da_presidencia(a, destino):
            diferente = False
        if diferente:
            sugestao["lotacao"] = {
                "siorg_id": destino[-1].id,
                "caminho": [{"nivel": CAMPOS[u.profundidade][0], "nome": u.nome, "sigla": u.sigla} for u in destino],
            }

    if ex.funcao and not cargo_vazio(a.cargo_fce) and not cargo_equivale(a.cargo_fce, ex.funcao):
        sugestao["cargo"] = ex.funcao

    if not sugestao:
        return None
    if _assinatura(sugestao) == a.sugestao_descartada:
        return None
    return sugestao


def _assinatura(sugestao: dict) -> str:
    return hashlib.sha256(json.dumps(sugestao, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def registrar(db: Session, a: Analista, ex: Exercicio | None) -> None:
    """Guarda (ou limpa) a sugestão a partir do exercício visto agora. Não faz commit."""
    sugestao = calcular(db, a, ex)
    a.sugestao_atualizacao = json.dumps(sugestao, ensure_ascii=False) if sugestao else None
    a.sugestao_em = _agora() if sugestao else None
    a.conferido_portal_em = _agora()


def ler(a: Analista) -> dict | None:
    try:
        return json.loads(a.sugestao_atualizacao) if a.sugestao_atualizacao else None
    except ValueError:
        return None


def aceitar(db: Session, a: Analista) -> None:
    sugestao = ler(a)
    if not sugestao:
        return
    if "lotacao" in sugestao:
        destino = lotacao_siorg.caminho(db, sugestao["lotacao"]["siorg_id"])
        if destino:
            lotacao_auto.aplicar_lotacao(db, a, [u for u in destino if u.profundidade in CAMPOS])
    if "cargo" in sugestao:
        a.cargo_fce = sugestao["cargo"][:100]
        a.cargo_origem = "portal"
    limpar(a)


def descartar(a: Analista) -> None:
    sugestao = ler(a)
    if sugestao:
        a.sugestao_descartada = _assinatura(sugestao)
    limpar(a)


def limpar(a: Analista) -> None:
    a.sugestao_atualizacao = None
    a.sugestao_em = None
