"""favoritos, links de LinkedIn e Lattes, nível pós-doutorado

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS favoritos (
            analista_id INTEGER NOT NULL REFERENCES analistas(id) ON DELETE CASCADE,
            favorito_id INTEGER NOT NULL REFERENCES analistas(id) ON DELETE CASCADE,
            criado_em TIMESTAMPTZ DEFAULT now(),
            PRIMARY KEY (analista_id, favorito_id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_favoritos_favorito_id ON favoritos (favorito_id)")

    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS linkedin_url TEXT")
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS lattes_url TEXT")

    # ALTER TYPE ... ADD VALUE não pode rodar dentro de transação em versões antigas do PostgreSQL
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE nivelformacao ADD VALUE IF NOT EXISTS 'pos_doutorado'")


def downgrade() -> None:
    op.execute("ALTER TABLE analistas DROP COLUMN IF EXISTS lattes_url")
    op.execute("ALTER TABLE analistas DROP COLUMN IF EXISTS linkedin_url")
    op.execute("DROP TABLE IF EXISTS favoritos")
    # O valor 'pos_doutorado' permanece no enum: o PostgreSQL não remove valores de enum.
