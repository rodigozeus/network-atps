import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AnalistaOut, Formacao, Tema } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import { useAuth } from '@shared/hooks/useAuth'
import { Button, Input, Spinner } from '@shared/components'
import ProfileCard from './ProfileCard'
import ProfileEditForm from './ProfileEditForm'
import FormacaoList from './FormacaoList'
import TemaList from './TemaList'
import styles from './perfil.module.css'

type EditTab = 'perfil' | 'formacao'

export default function ProfilePage() {
  const [profile, setProfile] = useState<AnalistaOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editTab, setEditTab] = useState<EditTab>('perfil')
  const [isSaving, setIsSaving] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteSenha, setDeleteSenha] = useState('')
  const [deleteConfirmado, setDeleteConfirmado] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const profileFormRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  const { logout } = useAuth()

  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setDeleteSenha('')
    setDeleteConfirmado(false)
    setDeleteError(null)
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await perfilApi.deleteMe(deleteSenha)
      logout()
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setDeleteError(status === 401 ? 'Senha incorreta.' : 'Erro ao excluir conta. Tente novamente.')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    perfilApi
      .getMe()
      .then(setProfile)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = (updated: AnalistaOut) => {
    setProfile(updated)
    setEditMode(false)
  }

  const handleFormacaoChange = (formacoes: Formacao[]) => {
    setProfile((prev) => (prev ? { ...prev, formacoes } : prev))
  }

  const handleTemaChange = (temas: Tema[]) => {
    setProfile((prev) => (prev ? { ...prev, temas } : prev))
  }

  const handleSaveClick = () => {
    profileFormRef.current?.requestSubmit()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-16)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (!profile) return null

  if (editMode) {
    return (
      <div className={styles.page}>
        <div className={styles.editTabs}>
          <button
            className={`${styles.editTab} ${editTab === 'perfil' ? styles.editTabActive : ''}`}
            onClick={() => setEditTab('perfil')}
          >
            Dados do Perfil
          </button>
          <button
            className={`${styles.editTab} ${editTab === 'formacao' ? styles.editTabActive : ''}`}
            onClick={() => setEditTab('formacao')}
          >
            Formação & Temas
          </button>
        </div>

        <div style={{ display: editTab === 'perfil' ? 'block' : 'none' }}>
          <ProfileEditForm
            ref={profileFormRef}
            profile={profile}
            onSave={handleSave}
            onSubmittingChange={setIsSaving}
          />
        </div>

        <div style={{ display: editTab === 'formacao' ? 'block' : 'none' }}>
          <div className={styles.editPage}>
            <TemaList temas={profile.temas} onChange={handleTemaChange} />
            <FormacaoList formacoes={profile.formacoes} onChange={handleFormacaoChange} />
          </div>
        </div>

        <div className={styles.formFooter}>
          <Button type="button" variant="outline" onClick={() => setEditMode(false)}>
            Cancelar
          </Button>
          <Button type="button" loading={isSaving} onClick={handleSaveClick}>
            {isSaving ? <Spinner size="sm" color="white" /> : null}
            Salvar alterações
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <ProfileCard profile={profile} />
      <div className={styles.actions}>
        <Button onClick={() => setEditMode(true)}>Editar Perfil</Button>
      </div>

      <div className={styles.formCard} style={{ marginTop: 'var(--sp-8)', border: '1px solid var(--color-danger)' }}>
        <p className={styles.formCardTitle}>Zona de risco</p>
        <p className={styles.modalText} style={{ marginBottom: 'var(--sp-4)' }}>
          Excluir sua conta apaga permanentemente todos os seus dados pessoais e profissionais
          da Rede ATPS, em conformidade com a LGPD. Essa ação não pode ser desfeita.
        </p>
        <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
          Excluir minha conta
        </Button>
      </div>

      {showDeleteModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <p className={styles.modalTitle}>Excluir conta permanentemente?</p>
            <p className={styles.modalText}>
              Esta ação é <strong>irreversível</strong>. Todos os seus dados pessoais — perfil,
              formações, temas de atuação e foto — serão apagados definitivamente do banco de
              dados e não poderão ser recuperados.
            </p>

            <label className={styles.toggleLabel} style={{ marginBottom: 'var(--sp-4)' }}>
              <input
                type="checkbox"
                className={styles.toggle}
                checked={deleteConfirmado}
                onChange={(e) => setDeleteConfirmado(e.target.checked)}
              />
              Tenho certeza absoluta que desejo excluir minha conta permanentemente.
            </label>

            <Input
              type="password"
              label="Confirme sua senha"
              value={deleteSenha}
              onChange={(e) => setDeleteSenha(e.target.value)}
              disabled={!deleteConfirmado}
              autoComplete="current-password"
            />
            {deleteError && <p className={styles.apiError} style={{ marginTop: 'var(--sp-3)' }}>{deleteError}</p>}

            <div className={styles.modalActions} style={{ marginTop: 'var(--sp-5)' }}>
              <Button type="button" variant="outline" size="sm" onClick={closeDeleteModal} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={deleting}
                disabled={!deleteConfirmado || !deleteSenha}
                onClick={handleDeleteAccount}
              >
                Excluir definitivamente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
