import { useEffect, useId, useState } from 'react'
import { documentosApi } from '@shared/api/perfil'
import type { DocumentoLegal } from '@shared/api/types'
import styles from './auth.module.css'

export const TERMO_CONSENTIMENTO = 'termo_consentimento'
export const AUTORIZACAO_CONSULTA_CPF = 'autorizacao_consulta_cpf'

/** Versões vigentes dos documentos, servidas pelo backend (fonte única do texto). */
export function useDocumentosAtuais() {
  const [documentos, setDocumentos] = useState<Record<string, DocumentoLegal>>({})
  const [erro, setErro] = useState(false)

  useEffect(() => {
    documentosApi
      .getAtuais()
      .then((docs) => setDocumentos(Object.fromEntries(docs.map((d) => [d.tipo, d]))))
      .catch(() => setErro(true))
  }, [])

  const versoes = Object.fromEntries(Object.values(documentos).map((d) => [d.tipo, d.versao]))
  return { documentos, versoes, carregado: Object.keys(documentos).length > 0, erro }
}

/** Texto em blocos: linha "1. Título" vira subtítulo; o resto, parágrafos */
function TextoDocumento({ texto }: { texto: string }) {
  return (
    <>
      {texto.split('\n').filter((l) => l.trim()).map((linha, i) =>
        /^\d+\. /.test(linha) ? <h3 key={i}>{linha}</h3> : <p key={i}>{linha}</p>)}
    </>
  )
}

export function DocumentoBox({ doc }: { doc: DocumentoLegal | undefined }) {
  const tituloId = useId()
  if (!doc) return null
  return (
    <>
      <h2 className={styles.termosLabel} id={tituloId}>
        {doc.titulo} <span className={styles.termosVersao}>(versão {doc.versao})</span>
      </h2>
      <div className={styles.termosBox} tabIndex={0} role="region" aria-labelledby={tituloId}>
        <TextoDocumento texto={doc.texto} />
      </div>
    </>
  )
}
