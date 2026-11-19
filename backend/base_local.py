"""Cópia local dos ATPS ativos, tirada do download em massa do Portal da Transparência
(dados abertos do SIAPE, arquivo AAAAMM_Cadastro.csv).

Serve de reserva quando a API do Portal não responde (cadastro, regularização e conferência
do perfil) e de universo para o painel de cobertura. Só confirma vínculo — nunca nega: é
mensal e não inclui aposentados.

Do CPF, a fonte só divulga os 6 dígitos do meio ("***.213.393-**"); aqui eles ficam como
HMAC. A confirmação exige esses dígitos e o nome conferindo.

Atualização (todo mês, com o arquivo novo):
    python base_local.py extrair AAAAMM_Cadastro.csv > atps.csv   # no computador, fora do servidor
    python base_local.py importar AAAAMM atps.csv                  # no container da API
"""
import csv
import hashlib
import hmac
import sys
import unicodedata

# Sem importar o app no topo: `extrair` roda fora do servidor, sem banco nem .env.
CARGO_ATPS = "POLITICAS SOCIAIS"

CAMPOS = ["id", "cpf_meio", "nome", "cod_org_exercicio", "org_exercicio", "uorg_exercicio",
          "funcao_sigla", "funcao_nivel", "atividade", "ano_ingresso_servico_publico"]


def _normalizar(texto: str) -> str:
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", texto or "") if not unicodedata.combining(c))
    return " ".join(sem_acento.upper().split())


def hash_meio(seis_digitos: str) -> str:
    from database import settings
    chave = settings.cpf_hash_secret.encode()
    return hmac.new(chave, f"meio:{seis_digitos}".encode(), hashlib.sha256).hexdigest()


def consultar(cpf_limpo: str, nome_informado: str):
    """Confirmação pela cópia local (ResultadoVerificacao), ou None (sem conclusão)."""
    from sqlalchemy import select
    from database import SessionLocal
    from models import BaseAtps, UnidadeSiorg
    from portal_transparencia import (
        Exercicio, ResultadoVerificacao, StatusVerificacao, formatar_funcao, nomes_conferem,
    )

    with SessionLocal() as db:
        candidatos = db.scalars(select(BaseAtps).where(BaseAtps.cpf_meio_hash == hash_meio(cpf_limpo[3:9]))).all()
        achados = [c for c in candidatos if nomes_conferem(nome_informado, c.nome)]
        if len(achados) != 1:
            return None
        b = achados[0]
        sigla = None
        if b.orgao_siorg_id:
            orgao = db.get(UnidadeSiorg, b.orgao_siorg_id)
            sigla = orgao.sigla if orgao else None
        ex = Exercicio(
            orgao_sigla=sigla, orgao_nome=b.org_exercicio, unidade=b.uorg_exercicio,
            funcao=formatar_funcao(b.funcao_sigla, b.funcao_nivel, b.atividade),
            ano_ingresso_servico_publico=b.ano_ingresso_servico_publico,
            orgao_siorg_id=b.orgao_siorg_id, fonte="base_local",
        )
        return ResultadoVerificacao(StatusVerificacao.confirmado, ex)


def importar(db, referencia: str, linhas: list[dict]) -> int:
    """Substitui a cópia inteira e liga cada órgão de exercício ao órgão do SIORG."""
    from sqlalchemy import delete, select
    from lotacao_auto import casar_orgao
    from models import BaseAtps, UnidadeSiorg

    orgaos = list(db.scalars(select(UnidadeSiorg).where(UnidadeSiorg.profundidade == 0)))
    mapa: dict[str, int | None] = {}
    db.execute(delete(BaseAtps))
    for l in linhas:
        org = l.get("org_exercicio") or ""
        if org not in mapa:
            achado = casar_orgao(org, None, orgaos)
            mapa[org] = achado.id if achado else None
        db.add(BaseAtps(
            id=int(l["id"]), cpf_meio_hash=hash_meio(l["cpf_meio"]), nome=l["nome"][:200],
            cod_org_exercicio=l.get("cod_org_exercicio") or None, org_exercicio=org[:200] or None,
            uorg_exercicio=(l.get("uorg_exercicio") or "")[:200] or None, orgao_siorg_id=mapa[org],
            funcao_sigla=l.get("funcao_sigla") or None, funcao_nivel=l.get("funcao_nivel") or None,
            atividade=(l.get("atividade") or "")[:120] or None,
            ano_ingresso_servico_publico=int(l["ano_ingresso_servico_publico"]) if l.get("ano_ingresso_servico_publico") else None,
            referencia=referencia,
        ))
    db.commit()
    sem_orgao = sorted({o for o, i in mapa.items() if i is None and o})
    if sem_orgao:
        print("Órgãos de exercício sem correspondência no SIORG:", sem_orgao)
    return len(linhas)


def extrair(caminho_cadastro: str, saida) -> int:
    """Do AAAAMM_Cadastro.csv (latin-1, ';') para um CSV só com os ATPS e os campos usados.
    A função comissionada vem numa linha separada do mesmo servidor."""
    def ler():
        f = open(caminho_cadastro, encoding="latin-1", newline="")
        r = csv.reader(f, delimiter=";")
        return {c: i for i, c in enumerate(next(r))}, r

    ix, r = ler()
    atps: dict[str, dict] = {}
    for row in r:
        if CARGO_ATPS not in _normalizar(row[ix["DESCRICAO_CARGO"]]):
            continue
        cpf = "".join(ch for ch in row[ix["CPF"]] if ch.isdigit())
        if len(cpf) != 6:
            continue
        uorg = row[ix["UORG_EXERCICIO"]].strip()
        atps[row[ix["Id_SERVIDOR_PORTAL"]]] = {
            "id": row[ix["Id_SERVIDOR_PORTAL"]], "cpf_meio": cpf, "nome": row[ix["NOME"]].strip(),
            "cod_org_exercicio": row[ix["COD_ORG_EXERCICIO"]].strip(),
            "org_exercicio": row[ix["ORG_EXERCICIO"]].strip(),
            "uorg_exercicio": "" if "INFORMA" in _normalizar(uorg) else uorg,
            "funcao_sigla": "", "funcao_nivel": "", "atividade": "",
            "ano_ingresso_servico_publico": row[ix["DATA_DIPLOMA_INGRESSO_SERVICOPUBLICO"]][-4:].strip(),
        }
    ix, r = ler()
    for row in r:
        a = atps.get(row[ix["Id_SERVIDOR_PORTAL"]])
        sigla = row[ix["SIGLA_FUNCAO"]].strip()
        if a is None or not sigla or sigla == "-1":
            continue
        a.update(funcao_sigla=sigla, funcao_nivel=row[ix["NIVEL_FUNCAO"]].strip(), atividade=row[ix["ATIVIDADE"]].strip())
    w = csv.DictWriter(saida, fieldnames=CAMPOS)
    w.writeheader()
    w.writerows(atps.values())
    return len(atps)


if __name__ == "__main__":
    if sys.argv[1:2] == ["extrair"]:
        n = extrair(sys.argv[2], sys.stdout)
        print(f"{n} ATPS extraídos", file=sys.stderr)
    elif sys.argv[1:2] == ["importar"]:
        from database import SessionLocal
        with open(sys.argv[3], encoding="utf-8", newline="") as f, SessionLocal() as sessao:
            print(f"{importar(sessao, sys.argv[2], list(csv.DictReader(f)))} ATPS importados")
    else:
        sys.exit(__doc__)
