"""role_andeps

Revision ID: d6e1f5a4b9c0
Revises: c5d0e4f3a8b9
Create Date: 2026-04-28 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd6e1f5a4b9c0'
down_revision: Union[str, None] = 'c5d0e4f3a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'andeps'")


def downgrade() -> None:
    # Não é possível remover valor de enum no PostgreSQL sem recriar o tipo
    pass
