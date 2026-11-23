"""remove as visitas da antiga página pública /sobre

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-11-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DELETE FROM acessos WHERE tipo = 'sobre'")


def downgrade() -> None:
    pass
