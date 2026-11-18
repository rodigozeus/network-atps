import { useEffect, useState } from 'react'
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

export function DocumentoBox({ doc }: { doc: DocumentoLegal | undefined }) {
  if (!doc) return null
  return (
    <>
      <p className={styles.termosLabel}>
        {doc.titulo} <span style={{ fontWeight: 400 }}>(versão {doc.versao})</span>
      </p>
      <div className={styles.termosBox} tabIndex={0}>
        {doc.texto}
      </div>
    </>
  )
}
