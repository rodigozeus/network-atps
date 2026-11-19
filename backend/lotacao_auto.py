"""Preenchimento automático da lotação com o órgão e a unidade de exercício do Portal da
Transparência, casados com a estrutura oficial do SIORG.

Só acontece com a Autorização de consulta do CPF v2 aceita, e só quando a lotação do
perfil está em branco. O ministério casa pela sigla (o Portal e o SIORG usam a mesma).
A unidade vem do SIAPE abreviada e truncada em 40 caracteres ("CGERAL DE INCL PROD, ENFR
A POB E A FOME"): casa quando cada palavra é prefixo da palavra oficial correspondente,
na ordem, e há um único melhor candidato. Na dúvida, preenche só o ministério.
"""
import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

import novidades
from documentos_legais import AUTORIZACAO_CONSULTA_CPF
from models import Analista, UnidadeSiorg
from portal_transparencia import Exercicio
from siorg import CAMPOS_ATE

VERSAO_MINIMA_AUTORIZACAO = 2

# Campos do perfil por profundidade na árvore do SIORG: (nome, sigla)
CAMPOS = {
    0: ("ministerio", "ministerio_sigla"),
    1: ("secretaria", "secretaria_sigla"),
    2: ("departamento", "departamento_sigla"),
    3: ("coordenacao_geral", None),
    4: ("coordenacao", None),
}

PALAVRAS_VAZIAS = {"A", "AS", "O", "OS", "DE", "DA", "DAS", "DO", "DOS", "E", "EM", "NA", "NAS", "NO", "NOS",
                   "PARA", "AO", "AOS", "COM", "POR", "SEM"}

# Tipo da unidade no início do nome, abreviado de várias formas no SIAPE
TIPOS = [
    (r"(COORDENACAO|COORD|COOR|COO)[ -]*GERAL|COORD[ -]*GER|CGERAL|C[ -]G|CG", "CG"),
    (r"SUBSECRETARIA|SUBSEC", "SUBSEC"),
    (r"SECRETARIA[ -]EXECUTIVA", "SE"),
    (r"SECRETARIA|SECRET|SEC", "SEC"),
    (r"DEPARTAMENTO|DEPTO|DEP", "DEP"),
    (r"DIRETORIA|DIRET|DIR", "DIR"),
    (r"COORDENACAO|COORD|COOR", "CO"),
    (r"ASSESSORIA|ASSES|ASS", "ASS"),
    (r"GABINETE|GAB", "GAB"),
    (r"DIVISAO|DIVI|DIV", "DIV"),
    (r"SERVICO|SERV", "SERV"),
]
_TIPO_RE = [(re.compile(rf"^(?:{p})\b[ -]*"), t) for p, t in TIPOS]


def normalizar(texto: str) -> str:
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", texto or "") if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^A-Z0-9 -]", " ", sem_acento.upper()).split())


def _separar(nome: str) -> tuple[str | None, list[str]]:
    """(tipo, palavras significativas)"""
    n = normalizar(nome)
    tipo = None
    for regex, t in _TIPO_RE:
        m = regex.match(n)
        if m:
            tipo, n = t, n[m.end():]
            break
    palavras = [p for p in re.split(r"[ -]+", n) if p and p not in PALAVRAS_VAZIAS]
    return tipo, palavras


def _abreviacao_de(curtas: list[str], longas: list[str]) -> bool:
    """Cada palavra curta é prefixo de uma palavra longa, na ordem, sem pular mais de uma."""
    if not curtas:
        return False
    j = pulos = 0
    for c in curtas:
        while j < len(longas) and not longas[j].startswith(c):
            j += 1
            pulos += 1
        if j == len(longas) or pulos > 1:
            return False
        j += 1
    return True


def casar_unidade(siape: str, candidatas: list[UnidadeSiorg]) -> UnidadeSiorg | None:
    tipo, palavras = _separar(siape)
    # uma palavra curta solta ("COORDENACAO SE") casaria com qualquer coisa
    if not palavras or (len(palavras) == 1 and len(palavras[0]) < 5):
        return None
    truncado = len(siape.strip()) >= 38  # o SIAPE corta em 40 caracteres
    achadas = []
    for u in candidatas:
        tipo_u, palavras_u = _separar(u.nome)
        if tipo and tipo_u and tipo != tipo_u:
            continue
        if not _abreviacao_de(palavras, palavras_u):
            continue
        # sem truncamento, a unidade oficial não pode ter palavras sobrando no fim
        if not truncado and len(palavras_u) > len(palavras) + 1:
            continue
        achadas.append((len(palavras_u) - len(palavras), u))
    if not achadas:
        return None
    # prefere a que deixa menos palavras oficiais sem correspondência; empate = ambíguo
    menor = min(sobra for sobra, _ in achadas)
    melhores = [u for sobra, u in achadas if sobra == menor]
    return melhores[0] if len(melhores) == 1 else None


def pode_preencher(a: Analista) -> bool:
    versao = a.versao_aceita(AUTORIZACAO_CONSULTA_CPF)
    return versao is not None and versao >= VERSAO_MINIMA_AUTORIZACAO and not (a.ministerio or "").strip()


def preencher(db: Session, a: Analista, ex: Exercicio | None) -> bool:
    """Preenche a lotação em branco. Devolve True se preencheu. Não faz commit."""
    if ex is None or not ex.orgao_sigla or not pode_preencher(a):
        return False
    orgao = db.scalars(
        select(UnidadeSiorg).where(UnidadeSiorg.profundidade == 0)
    ).all()
    orgao = next((o for o in orgao if (o.sigla or "").upper() == ex.orgao_sigla.strip().upper()), None)
    if orgao is None:
        return False

    caminho = [orgao]
    if ex.unidade:
        candidatas = db.scalars(
            select(UnidadeSiorg).where(UnidadeSiorg.orgao_id == orgao.id, UnidadeSiorg.profundidade > 0)
        ).all()
        unidade = casar_unidade(ex.unidade, list(candidatas))
        if unidade is not None:
            por_id = {u.id: u for u in candidatas}
            cadeia = []
            atual = unidade
            while atual is not None and atual.profundidade > 0:
                cadeia.append(atual)
                atual = por_id.get(atual.pai_id)
            caminho += [u for u in reversed(cadeia) if u.profundidade <= CAMPOS_ATE]

    antes = novidades.foto_lotacao(a)
    for nome, sigla in CAMPOS.values():
        setattr(a, nome, None)
        if sigla:
            setattr(a, sigla, None)
    for u in caminho:
        nome, sigla = CAMPOS[u.profundidade]
        setattr(a, nome, u.nome[:200])
        if sigla:
            setattr(a, sigla, (u.sigla or "")[:30] or None)
    a.lotacao_origem = "portal"
    if a.id is not None:
        novidades.registrar_lotacao(db, a, antes)
    return True
