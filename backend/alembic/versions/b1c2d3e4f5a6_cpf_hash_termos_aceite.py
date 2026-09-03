"""cpf_hash_termos_aceite

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-09-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS cpf_hash VARCHAR(64)")
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_analistas_cpf_hash "
        "ON analistas (cpf_hash)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_analistas_cpf_hash")
    op.execute("ALTER TABLE analistas DROP COLUMN IF EXISTS termos_aceitos_em")
    op.execute("ALTER TABLE analistas DROP COLUMN IF EXISTS cpf_hash")
