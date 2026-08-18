"""telefone_institucional_nullable

Revision ID: b4c9d3e2f6a7
Revises: a3b8c2d1e4f5
Create Date: 2026-04-28 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b4c9d3e2f6a7'
down_revision: Union[str, None] = 'a3b8c2d1e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('analistas', 'telefone_institucional',
                    existing_type=sa.String(length=30),
                    nullable=True)


def downgrade() -> None:
    op.execute(
        "UPDATE analistas SET telefone_institucional = '' WHERE telefone_institucional IS NULL"
    )
    op.alter_column('analistas', 'telefone_institucional',
                    existing_type=sa.String(length=30),
                    nullable=False)
