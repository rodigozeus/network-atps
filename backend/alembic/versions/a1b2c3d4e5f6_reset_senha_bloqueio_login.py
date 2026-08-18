"""reset_senha_bloqueio_login

Revision ID: a1b2c3d4e5f6
Revises: f8a3b7c2d9e1
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f8a3b7c2d9e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(64)")
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS reset_token_expires_em TIMESTAMPTZ")
    op.execute(
        "ALTER TABLE analistas ADD COLUMN IF NOT EXISTS login_tentativas_falhas "
        "INTEGER NOT NULL DEFAULT 0"
    )
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS login_bloqueado_ate TIMESTAMPTZ")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_analistas_reset_token_hash "
        "ON analistas (reset_token_hash)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_analistas_reset_token_hash")
    op.execute("ALTER TABLE analistas DROP COLUMN IF EXISTS login_bloqueado_ate")
    op.execute("ALTER TABLE analistas DROP COLUMN IF EXISTS login_tentativas_falhas")
    op.execute("ALTER TABLE analistas DROP COLUMN IF EXISTS reset_token_expires_em")
    op.execute("ALTER TABLE analistas DROP COLUMN IF EXISTS reset_token_hash")
