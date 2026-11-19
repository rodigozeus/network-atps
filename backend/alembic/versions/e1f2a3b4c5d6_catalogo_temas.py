"""catálogo de temas (áreas de política e ferramentas e métodos)

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-11-19 12:00:00.000000

Cria a tabela temas com a lista inicial (temas_iniciais.py) e liga cada tema dos perfis a ela:
quem bate com nome ou apelido da lista vai para o tema oficial (com o nome oficial); o resto vira
tema "a revisar" na curadoria.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from catalogo_temas import chave, normalizar
    from temas_iniciais import TEMAS_INICIAIS, TIPO_DOS_EXISTENTES

    op.create_table(
        "temas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nome", sa.String(120), nullable=False, unique=True),
        sa.Column("tipo", sa.String(12), nullable=False, server_default="area"),
        sa.Column("apelidos", sa.Text, nullable=False, server_default=""),
        sa.Column("revisado", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("criado_por_id", sa.Integer, sa.ForeignKey("analistas.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column("temas_atuacao", sa.Column("tema_id", sa.Integer, sa.ForeignKey("temas.id"), nullable=True))
    op.create_index("ix_temas_atuacao_tema_id", "temas_atuacao", ["tema_id"])

    con = op.get_bind()
    por_chave: dict[str, tuple[int, str]] = {}
    for nome, tipo, apelidos in TEMAS_INICIAIS:
        tid = con.execute(
            sa.text("INSERT INTO temas (nome, tipo, apelidos, revisado) VALUES (:n, :t, :a, true) RETURNING id"),
            {"n": nome, "t": tipo, "a": "\n".join(apelidos)},
        ).scalar_one()
        for k in [chave(nome), *(chave(a) for a in apelidos)]:
            por_chave.setdefault(k, (tid, nome))

    for rid, texto in con.execute(sa.text("SELECT id, tema FROM temas_atuacao")).all():
        nome = normalizar(texto)[:120] or "Sem nome"
        k = chave(nome)
        if k not in por_chave:
            tid = con.execute(
                sa.text("INSERT INTO temas (nome, tipo, apelidos, revisado) VALUES (:n, :t, '', false) RETURNING id"),
                {"n": nome, "t": TIPO_DOS_EXISTENTES.get(k, "area")},
            ).scalar_one()
            por_chave[k] = (tid, nome)
        tid, oficial = por_chave[k]
        con.execute(sa.text("UPDATE temas_atuacao SET tema_id = :t, tema = :n WHERE id = :i"),
                    {"t": tid, "n": oficial, "i": rid})

    # a mesma pessoa com dois textos que viraram o mesmo tema: fica um só
    con.execute(sa.text("""
        DELETE FROM temas_atuacao a USING temas_atuacao b
        WHERE a.analista_id = b.analista_id AND a.tema_id = b.tema_id AND a.id > b.id
    """))
    con.execute(sa.text("""
        DELETE FROM eventos_perfil
        WHERE tipo = 'tema' AND ref_id NOT IN (SELECT id FROM temas_atuacao)
    """))


def downgrade() -> None:
    op.drop_index("ix_temas_atuacao_tema_id", table_name="temas_atuacao")
    op.drop_column("temas_atuacao", "tema_id")
    op.drop_table("temas")
