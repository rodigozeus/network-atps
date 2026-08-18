import { useState } from 'react'
import type { AnalistaAdminOut, AnalistaAdminUpdate } from '../api/admin'
import { updateUsuario } from '../api/admin'
import styles from '../admin.module.css'

const TURMAS: { value: string; label: string }[] = [
  { value: 'turma_2012', label: 'Turma de 2012' },
  { value: 'turma_2016', label: 'Turma de 2016' },
  { value: 'turma_2024_cpnu', label: 'Turma de 2024 (CPNU)' },
]

interface Props {
  analista: AnalistaAdminOut
  onClose: () => void
  onSaved: (updated: AnalistaAdminOut) => void
}

export default function EditarUsuarioModal({ analista, onClose, onSaved }: Props) {
  const [form, setForm] = useState<AnalistaAdminUpdate>({
    nome: analista.nome,
    email_pessoal: analista.email_pessoal,
    email_institucional: analista.email_institucional ?? '',
    telefone_institucional: analista.telefone_institucional ?? '',
    celular: analista.celular ?? '',
    ministerio: analista.ministerio ?? '',
    ministerio_sigla: analista.ministerio_sigla ?? '',
    secretaria: analista.secretaria ?? '',
    secretaria_sigla: analista.secretaria_sigla ?? '',
    departamento: analista.departamento ?? '',
    departamento_sigla: analista.departamento_sigla ?? '',
    coordenacao_geral: analista.coordenacao_geral ?? '',
    coordenacao: analista.coordenacao ?? '',
    cargo_fce: analista.cargo_fce ?? '',
    portal_url: analista.portal_url ?? '',
    turma: analista.turma ?? undefined,
    role: analista.role,
    ativo: analista.ativo,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload: AnalistaAdminUpdate = {}
      for (const [k, v] of Object.entries(form)) {
        payload[k as keyof AnalistaAdminUpdate] = (v === '' ? null : v) as never
      }
      const updated = await updateUsuario(analista.id, payload)
      onSaved(updated)
    } catch {
      setError('Erro ao salvar. Verifique os dados e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Editar analista</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Nome</label>
              <input className={styles.formInput} name="nome" value={form.nome ?? ''} onChange={handleChange} required />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email pessoal</label>
              <input className={styles.formInput} name="email_pessoal" type="email" value={form.email_pessoal ?? ''} onChange={handleChange} required />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email institucional</label>
              <input className={styles.formInput} name="email_institucional" type="email" value={form.email_institucional ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Telefone institucional</label>
              <input className={styles.formInput} name="telefone_institucional" value={form.telefone_institucional ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Celular</label>
              <input className={styles.formInput} name="celular" value={form.celular ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Ministério</label>
              <input className={styles.formInput} name="ministerio" value={form.ministerio ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Sigla do ministério</label>
              <input className={styles.formInput} name="ministerio_sigla" value={form.ministerio_sigla ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Secretaria</label>
              <input className={styles.formInput} name="secretaria" value={form.secretaria ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Sigla da secretaria</label>
              <input className={styles.formInput} name="secretaria_sigla" value={form.secretaria_sigla ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Departamento</label>
              <input className={styles.formInput} name="departamento" value={form.departamento ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Sigla do departamento</label>
              <input className={styles.formInput} name="departamento_sigla" value={form.departamento_sigla ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Coordenação geral</label>
              <input className={styles.formInput} name="coordenacao_geral" value={form.coordenacao_geral ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Coordenação</label>
              <input className={styles.formInput} name="coordenacao" value={form.coordenacao ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cargo FCE</label>
              <input className={styles.formInput} name="cargo_fce" value={form.cargo_fce ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Portal URL</label>
              <input className={styles.formInput} name="portal_url" value={form.portal_url ?? ''} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Turma</label>
              <select className={styles.formSelect} name="turma" value={form.turma ?? ''} onChange={handleChange}>
                <option value="">Selecione…</option>
                {TURMAS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Role</label>
              <select className={styles.formSelect} name="role" value={form.role} onChange={handleChange}>
                <option value="analista">Analista</option>
                <option value="andeps">Andeps</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Status</label>
              <select className={styles.formSelect} name="ativo" value={form.ativo ? 'true' : 'false'} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.value === 'true' }))}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </div>
          </div>

          {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-sm)', marginTop: 'var(--sp-4)' }}>{error}</p>}

          <div className={styles.modalFooter}>
            <button type="button" onClick={onClose} style={{ padding: '8px 20px', borderRadius: 'var(--r)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 'var(--font-sm)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ padding: '8px 20px', borderRadius: 'var(--r)', border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 'var(--font-sm)', fontWeight: 600 }}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
