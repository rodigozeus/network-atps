"""email_pessoal_primary_identifier

Revision ID: a3b8c2d1e4f5
Revises: 1f5041d00621
Create Date: 2026-04-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3b8c2d1e4f5'
down_revision: Union[str, None] = '1f5041d00621'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove unique index on email_institucional
    op.drop_index('ix_analistas_email_institucional', table_name='analistas')

    # Make email_institucional nullable
    op.alter_column('analistas', 'email_institucional',
                    existing_type=sa.String(length=200),
                    nullable=True)

    # Make email_pessoal NOT NULL and add unique index
    # First ensure any existing NULL values are handled (set to placeholder if needed)
    op.execute(
        "UPDATE analistas SET email_pessoal = 'migrado_' || id || '@placeholder.invalid' "
        "WHERE email_pessoal IS NULL"
    )
    op.alter_column('analistas', 'email_pessoal',
                    existing_type=sa.String(length=200),
                    nullable=False)
    op.create_index('ix_analistas_email_pessoal', 'analistas', ['email_pessoal'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_analistas_email_pessoal', table_name='analistas')
    op.alter_column('analistas', 'email_pessoal',
                    existing_type=sa.String(length=200),
                    nullable=True)
    op.alter_column('analistas', 'email_institucional',
                    existing_type=sa.String(length=200),
                    nullable=False)
    op.create_index('ix_analistas_email_institucional', 'analistas', ['email_institucional'], unique=True)
