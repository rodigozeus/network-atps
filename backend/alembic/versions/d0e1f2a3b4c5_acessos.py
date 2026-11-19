"""contagem de visitas (acessos)

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-11-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd0e1f2a3b4c5'
down_revision: Union[str, None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS acessos (
            id SERIAL PRIMARY KEY,
            dia DATE NOT NULL,
            tipo VARCHAR(10) NOT NULL,
            analista_id INTEGER REFERENCES analistas(id) ON DELETE SET NULL,
            criado_em TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_acessos_dia ON acessos (dia)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_acessos_analista_id ON acessos (analista_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS acessos")
