"""lançamento: busca sem acento, em que posso ajudar, código SIORG, base local de ATPS,
páginas de unidade, perfil sempre atualizado, novidades da rede, limite de e-mail

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUNAS = {
    "pode_ajudar": "TEXT",
    "lotacao_siorg_id": "INTEGER",
    "cargo_origem": "VARCHAR(20)",
    "turma_origem": "VARCHAR(20)",
    "sugestao_atualizacao": "TEXT",
    "sugestao_em": "TIMESTAMPTZ",
    "sugestao_descartada": "VARCHAR(64)",
    "conferido_portal_em": "TIMESTAMPTZ",
    "novidades_rede_vistas_em": "TIMESTAMPTZ",
}


def upgrade() -> None:
    # Busca sem acento e tolerante a erro de digitação
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    # unaccent() não é IMMUTABLE; o invólucro é o nome usado pelo código (e serve a índices)
    op.execute(
        "CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text "
        "LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT "
        "AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$"
    )

    for coluna, tipo in COLUNAS.items():
        op.execute(f"ALTER TABLE analistas ADD COLUMN IF NOT EXISTS {coluna} {tipo}")
    op.execute("CREATE INDEX IF NOT EXISTS ix_analistas_lotacao_siorg_id ON analistas (lotacao_siorg_id)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS unidades_siorg_detalhe (
            id INTEGER PRIMARY KEY,
            competencia TEXT,
            contato TEXT,
            endereco TEXT,
            atualizado_em TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS base_atps (
            id INTEGER PRIMARY KEY,
            cpf_meio_hash VARCHAR(64) NOT NULL,
            nome VARCHAR(200) NOT NULL,
            cod_org_exercicio VARCHAR(10),
            org_exercicio VARCHAR(200),
            uorg_exercicio VARCHAR(200),
            orgao_siorg_id INTEGER,
            funcao_sigla VARCHAR(10),
            funcao_nivel VARCHAR(10),
            atividade VARCHAR(120),
            ano_ingresso_servico_publico INTEGER,
            referencia VARCHAR(6) NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_base_atps_cpf_meio_hash ON base_atps (cpf_meio_hash)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_base_atps_orgao_siorg_id ON base_atps (orgao_siorg_id)")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS envios_email (
            id SERIAL PRIMARY KEY,
            tipo VARCHAR(40) NOT NULL,
            essencial BOOLEAN NOT NULL,
            enviado_em TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_envios_email_enviado_em ON envios_email (enviado_em)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS envios_email")
    op.execute("DROP TABLE IF EXISTS base_atps")
    op.execute("DROP TABLE IF EXISTS unidades_siorg_detalhe")
    for coluna in COLUNAS:
        op.execute(f"ALTER TABLE analistas DROP COLUMN IF EXISTS {coluna}")
    op.execute("DROP FUNCTION IF EXISTS f_unaccent(text)")
