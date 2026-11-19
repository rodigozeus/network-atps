"""Recompacta as fotos de perfil já enviadas (até 800 px, JPEG progressivo, sem metadados)
e gera as miniaturas de 240 px. Faz cópia de tudo antes, numa pasta ao lado.

    python fotos.py            # simulação: mostra o que faria
    python fotos.py --aplicar
"""
import os
import shutil
import sys
from datetime import datetime

from PIL import Image

from database import SessionLocal
from models import Analista
from routers.perfil import UPLOAD_DIR, remover_foto, salvar_foto


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
    recompactar("--aplicar" in sys.argv)
