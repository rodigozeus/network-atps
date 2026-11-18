from fastapi import APIRouter, HTTPException, status

from documentos_legais import DOCUMENTOS, documento_atual
from schemas import DocumentoOut

router = APIRouter(prefix="/documentos", tags=["documentos"])


def _out(doc) -> DocumentoOut:
    return DocumentoOut(
        tipo=doc.tipo, versao=doc.versao, vigente_desde=doc.vigente_desde,
        titulo=doc.titulo, texto=doc.texto, hash=doc.hash,
    )


@router.get("", response_model=list[DocumentoOut])
def listar_documentos():
    """Versões vigentes de todos os documentos (público — exibido antes do cadastro)."""
    return [_out(documento_atual(tipo)) for tipo in DOCUMENTOS]


@router.get("/{tipo}", response_model=DocumentoOut)
def obter_documento(tipo: str):
    if tipo not in DOCUMENTOS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento não encontrado")
    return _out(documento_atual(tipo))
