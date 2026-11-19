import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, settings
from routers import auth, perfil, busca, admin, documentos, favoritos, rede, unidades

_docs = settings.enable_docs
app = FastAPI(
    title="Rede ATPS API",
    version="0.1.0",
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(perfil.router)
app.include_router(busca.router)
app.include_router(admin.router)
app.include_router(documentos.router)
app.include_router(favoritos.router)
app.include_router(rede.router)
app.include_router(unidades.router)

# Fotos são servidas por rota autenticada em routers/perfil.py (não há mais diretório público).
os.makedirs("uploads/fotos", exist_ok=True)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "db": "ok"}
