"""campo_ativo_analistas

Revision ID: c5d0e4f3a8b9
Revises: b4c9d3e2f6a7
Create Date: 2026-04-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c5d0e4f3a8b9'
down_revision: Union[str, None] = 'b4c9d3e2f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true")


def downgrade() -> None:
    op.drop_column('analistas', 'ativo')
