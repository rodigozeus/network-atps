"""Manutenção das fotos de perfil.

    python fotos.py variantes             # gera as versões menores que faltarem (não mexe na foto)
    python fotos.py recompactar           # simulação da recompactação
    python fotos.py recompactar --aplicar # recompacta tudo (com cópia antes)
"""
import os
import shutil
import sys
from datetime import datetime

from PIL import Image

from database import SessionLocal
from models import Analista
from routers.perfil import UPLOAD_DIR, VARIANTES, caminho_variante, gravar_variantes, remover_foto, salvar_foto


def variantes() -> None:
    db = SessionLocal()
    for a in db.query(Analista).filter(Analista.foto_path.isnot(None)):
        if not os.path.exists(a.foto_path):
            continue
        if all(os.path.exists(caminho_variante(a.foto_path, s)) for s in VARIANTES):
            continue
        with Image.open(a.foto_path) as img:
            gravar_variantes(img.convert("RGB"), a.foto_path)
        print(f"conta {a.id}: versões menores geradas")


def recompactar(aplicar: bool) -> None:
    db = SessionLocal()
    contas = db.query(Analista).filter(Analista.foto_path.isnot(None)).all()
    if aplicar:
        backup = f"{UPLOAD_DIR}_backup_{datetime.now():%Y%m%d%H%M}"
        shutil.copytree(UPLOAD_DIR, backup)
        print("cópia em", backup)
    antes = depois = 0
    for a in contas:
        if not os.path.exists(a.foto_path):
            print(f"conta {a.id}: arquivo não encontrado, mantida")
            continue
        tamanho = os.path.getsize(a.foto_path)
        antes += tamanho
        if not aplicar:
            print(f"conta {a.id}: {tamanho // 1024} KB")
            continue
        with Image.open(a.foto_path) as img:
            novo = salvar_foto(img)
        remover_foto(a.foto_path)
        a.foto_path = novo
        db.commit()
        depois += os.path.getsize(novo)
        print(f"conta {a.id}: {tamanho // 1024} KB -> {os.path.getsize(novo) // 1024} KB")
    print(f"total: {antes // 1024} KB" + (f" -> {depois // 1024} KB" if aplicar else " (simulação)"))


if __name__ == "__main__":
    if sys.argv[1:2] == ["variantes"]:
        variantes()
    elif sys.argv[1:2] == ["recompactar"]:
        recompactar("--aplicar" in sys.argv)
    else:
        sys.exit(__doc__)
