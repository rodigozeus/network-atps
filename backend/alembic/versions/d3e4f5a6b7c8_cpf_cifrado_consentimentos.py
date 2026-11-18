"""cpf_cifrado_consentimentos

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-11-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS cpf_cifrado TEXT")
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS cpf_verificado_em TIMESTAMPTZ")
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS vinculo_manual BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS vinculo_suspenso_em TIMESTAMPTZ")
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS perfil_oculto BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS termo_versao_notificada INTEGER NOT NULL DEFAULT 0")
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE acaoconsentimento AS ENUM ('aceito', 'revogado');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS consentimentos (
            id SERIAL PRIMARY KEY,
            analista_id INTEGER NOT NULL REFERENCES analistas(id) ON DELETE CASCADE,
            tipo VARCHAR(50) NOT NULL,
            acao acaoconsentimento NOT NULL,
            documento_versao INTEGER,
            documento_hash VARCHAR(64),
            ip VARCHAR(64),
            user_agent VARCHAR(300),
            criado_em TIMESTAMPTZ
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_consentimentos_id ON consentimentos (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_consentimentos_analista_id ON consentimentos (analista_id)")
    # Contas ativas antes da reverificação não podem ser suspensas automaticamente:
    # não há como saber quais foram aprovadas manualmente. Elas passam a seguir a
    # regra automática quando o Portal confirmar o vínculo (tarefas.py); até lá, uma
    # não confirmação só gera alerta para o administrador.
    op.execute("UPDATE analistas SET vinculo_manual = TRUE WHERE ativo = TRUE")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS consentimentos")
    op.execute("DROP TYPE IF EXISTS acaoconsentimento")
    for coluna in ("termo_versao_notificada", "perfil_oculto", "vinculo_suspenso_em",
                   "vinculo_manual", "cpf_verificado_em", "cpf_cifrado"):
        op.execute(f"ALTER TABLE analistas DROP COLUMN IF EXISTS {coluna}")
