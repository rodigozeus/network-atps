"""campo_pendente_revisao

Revision ID: e7f2a6b3c1d8
Revises: d6e1f5a4b9c0
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7f2a6b3c1d8'
down_revision: Union[str, None] = 'd6e1f5a4b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'analistas',
        sa.Column('pendente_revisao', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('analistas', 'pendente_revisao')
