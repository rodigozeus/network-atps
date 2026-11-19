"""Termo de Consentimento v3 e Autorização de consulta do CPF v3, sem aviso por e-mail

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reaceite só na tela, no próximo acesso (decisão do mantenedor). 6 = termo v3 + autorização v3.
    op.execute("UPDATE analistas SET termo_versao_notificada = 6 WHERE termo_versao_notificada < 6")


def downgrade() -> None:
    pass
