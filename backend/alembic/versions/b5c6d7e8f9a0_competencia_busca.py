"""unidades: competência normalizada para a busca de unidades

Revision ID: b5c6d7e8f9a0
Revises: a3b4c5d6e7f8
Create Date: 2026-11-24 15:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'b5c6d7e8f9a0'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # preenchida pela importação do arquivo mensal (siorg.importar_detalhes)
    op.add_column("unidades_siorg_detalhe", sa.Column("competencia_busca", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("unidades_siorg_detalhe", "competencia_busca")
