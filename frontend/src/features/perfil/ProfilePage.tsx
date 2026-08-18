import { useEffect, useRef, useState } from 'react'
import type { AnalistaOut, Formacao, Tema } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import { Button, Spinner } from '@shared/components'
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

  const profileFormRef = useRef<HTMLFormElement>(null)

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
    </div>
  )
}
