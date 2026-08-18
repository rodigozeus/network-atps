"""campo_turma

Revision ID: f8a3b7c2d9e1
Revises: e7f2a6b3c1d8
Create Date: 2026-07-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'f8a3b7c2d9e1'
down_revision: Union[str, None] = 'e7f2a6b3c1d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            CREATE TYPE turma AS ENUM ('turma_2012', 'turma_2016', 'turma_2024_cpnu');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS turma turma")


def downgrade() -> None:
    op.execute("ALTER TABLE analistas DROP COLUMN IF EXISTS turma")
    op.execute("DROP TYPE IF EXISTS turma")
