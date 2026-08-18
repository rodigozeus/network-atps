import { useEffect, useRef, useState } from 'react'
import { api } from '@shared/api/client'
import styles from '../admin.module.css'

interface InfoLista {
  existe: boolean
  total_servidores: number
}

interface UploadResult {
  total_servidores: number
}

export default function ConfiguracoesPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [info, setInfo] = useState<InfoLista | null>(null)
  const [sucesso, setSucesso] = useState<UploadResult | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api.get<InfoLista>('/admin/lista-servidores').then(({ data }) => setInfo(data))
  }, [])

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setSucesso(null)
    setErro(null)
    try {
      const form = new FormData()
      form.append('arquivo', file)
      const { data } = await api.post<UploadResult>('/admin/lista-servidores', form)
      setSucesso(data)
      setInfo({ existe: true, total_servidores: data.total_servidores })
      if (fileRef.current) fileRef.current.value = ''
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErro(detail ?? 'Erro ao enviar o arquivo.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Configurações</h1>
      </div>

      <div className={styles.chartCard} style={{ maxWidth: 560 }}>
        <p className={styles.chartTitle}>Lista de servidores ATPs</p>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--sp-4)', lineHeight: 1.6 }}>
          Faça o upload do arquivo CSV exportado do portal da transparência.
          Ele é usado para validar automaticamente os novos cadastros — nomes
          encontrados na lista são ativados imediatamente; os demais ficam
          pendentes de revisão manual.
        </p>

        {info && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)', fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: info.existe ? '#22c55e' : '#d1d5db', flexShrink: 0, display: 'inline-block' }} />
            {info.existe
              ? <>Lista ativa — <strong style={{ color: 'var(--color-text)' }}>{info.total_servidores.toLocaleString('pt-BR')}</strong> servidores carregados</>
              : 'Nenhuma lista carregada — todos os cadastros são aceitos sem validação'}
          </div>
        )}

        {sucesso && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 'var(--r)', padding: 'var(--sp-3) var(--sp-4)', color: '#15803d', fontSize: 'var(--font-sm)', marginBottom: 'var(--sp-4)' }}>
            Lista atualizada com sucesso —{' '}
            <strong>{sucesso.total_servidores.toLocaleString('pt-BR')}</strong> servidores carregados.
          </div>
        )}

        {erro && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 'var(--r)', padding: 'var(--sp-3) var(--sp-4)', color: '#b91c1c', fontSize: 'var(--font-sm)', marginBottom: 'var(--sp-4)' }}>
            {erro}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className={styles.formInput}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--r)',
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 'var(--font-sm)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {uploading ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
