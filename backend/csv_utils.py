import csv
import re
import unicodedata
from pathlib import Path

CSV_PATH = Path(__file__).parent / "servidor.csv"

_nomes: set[str] | None = None


def _normalizar(nome: str) -> str:
    nfkd = unicodedata.normalize("NFKD", nome)
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sem_acento.lower().strip())


def resetar_cache() -> None:
    global _nomes
    _nomes = None


def _carregar() -> set[str]:
    global _nomes
    if _nomes is not None:
        return _nomes
    nomes: set[str] = set()
    try:
        with open(CSV_PATH, encoding="utf-8-sig") as f:
            reader = csv.reader(f, delimiter=";")
            next(reader)  # skip header
            for row in reader:
                if len(row) >= 3:
                    nome = row[2].strip()
                    if nome:
                        nomes.add(_normalizar(nome))
    except FileNotFoundError:
        pass
    _nomes = nomes
    return _nomes


def nome_consta_na_lista(nome: str) -> bool:
    """Retorna True se o nome for encontrado na lista de servidores (servidor.csv).
    Caso o CSV não seja encontrado, retorna True para não bloquear nenhum cadastro."""
    lista = _carregar()
    if not lista:
        return True
    return _normalizar(nome) in lista
