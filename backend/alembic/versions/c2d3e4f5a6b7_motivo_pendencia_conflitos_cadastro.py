"""motivo_pendencia_conflitos_cadastro

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-11-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS motivo_pendencia VARCHAR(300)")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS conflitos_cadastro (
            id SERIAL PRIMARY KEY,
            analista_id INTEGER NOT NULL REFERENCES analistas(id) ON DELETE CASCADE,
            nome_informado VARCHAR(200) NOT NULL,
            email_informado VARCHAR(200) NOT NULL,
            resolvido BOOLEAN NOT NULL DEFAULT FALSE,
            criado_em TIMESTAMPTZ
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_conflitos_cadastro_id ON conflitos_cadastro (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_conflitos_cadastro_analista_id ON conflitos_cadastro (analista_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS conflitos_cadastro")
    op.execute("ALTER TABLE analistas DROP COLUMN IF EXISTS motivo_pendencia")
