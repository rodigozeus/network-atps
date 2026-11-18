"""novidades de perfil para favoritos

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS visto_em TIMESTAMPTZ")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS eventos_perfil (
            id SERIAL PRIMARY KEY,
            analista_id INTEGER NOT NULL REFERENCES analistas(id) ON DELETE CASCADE,
            tipo VARCHAR(20) NOT NULL,
            ref_id INTEGER,
            descricao VARCHAR(500) NOT NULL,
            criado_em TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_eventos_perfil_analista_id ON eventos_perfil (analista_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_eventos_perfil_criado_em ON eventos_perfil (criado_em)")

    # Termo de Consentimento v2 (favoritos e novidades) sem aviso por e-mail, por decisão
    # do mantenedor: o reaceite aparece no próximo acesso. 3 = geração dos documentos
    # obrigatórios (termo v2 + autorização de CPF v1), ver tarefas.geracao_documentos().
    op.execute("UPDATE analistas SET termo_versao_notificada = 3 WHERE termo_versao_notificada < 3")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS eventos_perfil")
    op.execute("ALTER TABLE favoritos DROP COLUMN IF EXISTS visto_em")
