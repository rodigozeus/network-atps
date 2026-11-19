"""Tarefas diárias da Rede ATPS — serviço `atps-tarefas` do docker-compose.prod.yml.

    python tarefas.py          # executa uma vez
    python tarefas.py --loop   # executa uma vez por dia (uso no container)

1. Reverificação periódica do vínculo no Portal da Transparência.
2. Exclusão de contas com vínculo suspenso cujo prazo de contestação venceu.
3. Aviso por e-mail quando há nova versão de documento obrigatório.
4. Cópia da estrutura organizacional oficial (SIORG), usada nas listas de lotação.
5. Limpeza das novidades de perfil mais antigas que a retenção (novidades.RETENCAO_DIAS).

Os logs nunca incluem CPF, nome ou e-mail — só contagens e ids internos.
"""
import argparse
import logging
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, not_, or_
from sqlalchemy.orm import Session

from cpf_utils import decifrar_cpf
from database import SessionLocal
from documentos_legais import (
    OBRIGATORIOS, PRAZO_CONTESTACAO_DIAS, REVERIFICACAO_INTERVALO_DIAS, documento_atual,
)
from email_utils import (
    enviar_email_conta_excluida_vinculo,
    enviar_email_termos_atualizados,
    enviar_email_vinculo_suspenso,
)
from models import Analista
from novidades import RETENCAO_DIAS, apagar_antigas
import lotacao_auto
import siorg
from portal_transparencia import MOTIVOS, StatusVerificacao, consultar_situacao_atps
from routers.perfil import remover_foto

logger = logging.getLogger("tarefas")

LOTE_MAXIMO = 200
PAUSA_ENTRE_CONSULTAS_S = 1.0  # respeita o limite de requisições da API do Portal
INTERVALO_LOOP_S = 24 * 3600
ATRASO_INICIAL_S = 600  # após o deploy, dá tempo de as migrações rodarem


def reverificar_vinculos(db: Session, agora: datetime) -> None:
    limite = agora - timedelta(days=REVERIFICACAO_INTERVALO_DIAS)
    contas = (
        db.query(Analista)
        .filter(
            Analista.ativo.is_(True),
            Analista.cpf_cifrado.isnot(None),
            or_(
                Analista.vinculo_suspenso_em.isnot(None),
                Analista.cpf_verificado_em.is_(None),
                Analista.cpf_verificado_em < limite,
            ),
            # Conta manual já com alerta aberto: espera a decisão do administrador.
            not_(and_(Analista.vinculo_manual.is_(True), Analista.motivo_pendencia.isnot(None))),
        )
        .order_by(Analista.cpf_verificado_em.asc().nulls_first())
        .limit(LOTE_MAXIMO)
        .all()
    )

    contagem = {"confirmado": 0, "suspenso": 0, "alerta_admin": 0, "inconclusivo": 0}
    for conta in contas:
        resultado = consultar_situacao_atps(decifrar_cpf(conta.cpf_cifrado), None)
        time.sleep(PAUSA_ENTRE_CONSULTAS_S)

        if resultado.confirmado:
            lotacao_auto.preencher(db, conta, resultado.exercicio)
            conta.cpf_verificado_em = agora
            conta.vinculo_manual = False
            conta.vinculo_suspenso_em = None
            conta.motivo_pendencia = None
            contagem["confirmado"] += 1
        elif resultado.status == StatusVerificacao.nao_encontrado:
            if conta.vinculo_manual:
                # Aprovada manualmente: não suspende, só alerta o administrador.
                conta.motivo_pendencia = (
                    f"Reverificação de {agora:%d/%m/%Y}: {MOTIVOS[StatusVerificacao.nao_encontrado]}"
                )
                contagem["alerta_admin"] += 1
            elif conta.vinculo_suspenso_em is None:
                conta.vinculo_suspenso_em = agora
                conta.motivo_pendencia = MOTIVOS[StatusVerificacao.nao_encontrado]
                exclusao_em = agora + timedelta(days=PRAZO_CONTESTACAO_DIAS)
                enviar_email_vinculo_suspenso(
                    conta.email_pessoal, conta.nome, PRAZO_CONTESTACAO_DIAS, f"{exclusao_em:%d/%m/%Y}",
                )
                contagem["suspenso"] += 1
        else:
            contagem["inconclusivo"] += 1
        db.commit()

    logger.info("Reverificação: %d contas consultadas — %s", len(contas), contagem)


def excluir_suspensos_vencidos(db: Session, agora: datetime) -> None:
    limite = agora - timedelta(days=PRAZO_CONTESTACAO_DIAS)
    contas = db.query(Analista).filter(
        Analista.vinculo_suspenso_em.isnot(None),
        Analista.vinculo_suspenso_em <= limite,
        Analista.vinculo_manual.is_(False),
    ).all()
    for conta in contas:
        logger.info("Excluindo conta id=%d (vínculo não confirmado no prazo)", conta.id)
        enviar_email_conta_excluida_vinculo(conta.email_pessoal, conta.nome)
        remover_foto(conta.foto_path)
        db.delete(conta)
        db.commit()


def geracao_documentos() -> int:
    """Soma das versões vigentes dos documentos obrigatórios: aumenta sempre que
    qualquer um deles ganha nova versão."""
    return sum(documento_atual(t).versao for t in OBRIGATORIOS)


def avisar_novos_termos(db: Session, agora: datetime) -> None:
    geracao = geracao_documentos()
    contas = db.query(Analista).filter(
        Analista.ativo.is_(True),
        Analista.termo_versao_notificada < geracao,
    ).all()
    avisadas = 0
    for conta in contas:
        aceitou_versao_anterior = any(c.documento_versao for c in conta.consentimentos)
        # Contas que nunca aceitaram uma versão registrada (anteriores ao versionamento)
        # não recebem e-mail: a atualização cadastral aparece no próximo acesso.
        if aceitou_versao_anterior and "termos" in conta.pendencias:
            enviar_email_termos_atualizados(conta.email_pessoal, conta.nome)
            avisadas += 1
        conta.termo_versao_notificada = geracao
        db.commit()
    logger.info("Aviso de novos termos: %d e-mails enviados", avisadas)


def sincronizar_siorg(db: Session, agora: datetime) -> None:
    logger.info("SIORG: %d unidades sincronizadas", siorg.sincronizar(db))


def limpar_novidades(db: Session, agora: datetime) -> None:
    logger.info("Novidades com mais de %d dias apagadas: %d", RETENCAO_DIAS, apagar_antigas(db, agora))


def executar() -> None:
    agora = datetime.now(timezone.utc)
    for tarefa in (sincronizar_siorg, reverificar_vinculos, excluir_suspensos_vencidos, avisar_novos_termos, limpar_novidades):
        db = SessionLocal()
        try:
            tarefa(db, agora)
        except Exception:
            logger.exception("Falha na tarefa %s", tarefa.__name__)
            db.rollback()
        finally:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop", action="store_true", help="executa uma vez por dia, indefinidamente")
    args = parser.parse_args()

    if not args.loop:
        executar()
    else:
        time.sleep(ATRASO_INICIAL_S)
        while True:
            executar()
            time.sleep(INTERVALO_LOOP_S)
