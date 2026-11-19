"""estrutura do SIORG e preenchimento automático da lotação

Revision ID: a7b8c9d0e1f2
Revises: f5a6b7c8d9e0
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f5a6b7c8d9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS unidades_siorg (
            id INTEGER PRIMARY KEY,
            pai_id INTEGER,
            orgao_id INTEGER NOT NULL,
            nome VARCHAR(400) NOT NULL,
            sigla VARCHAR(60),
            profundidade INTEGER NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_unidades_siorg_pai_id ON unidades_siorg (pai_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_unidades_siorg_orgao_id ON unidades_siorg (orgao_id)")
    op.execute("ALTER TABLE analistas ADD COLUMN IF NOT EXISTS lotacao_origem VARCHAR(20)")

    # Autorização de consulta do CPF v2 sem aviso por e-mail (mesma decisão do Termo v2):
    # o reaceite aparece no próximo acesso. 4 = termo v2 + autorização v2.
    op.execute("UPDATE analistas SET termo_versao_notificada = 4 WHERE termo_versao_notificada < 4")


def downgrade() -> None:
    op.execute("ALTER TABLE analistas DROP COLUMN IF EXISTS lotacao_origem")
    op.execute("DROP TABLE IF EXISTS unidades_siorg")
