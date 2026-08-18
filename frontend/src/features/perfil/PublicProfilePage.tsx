import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { AnalistaPublico } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import { Spinner } from '@shared/components'
import ProfileCard from './ProfileCard'
import styles from './perfil.module.css'

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [profile, setProfile] = useState<AnalistaPublico | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    perfilApi
      .getAnalista(id)
      .then(setProfile)
      .catch((err: { response?: { status?: number } }) => {
        if (err.response?.status === 404) setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-16)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--sp-16)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Analista não encontrado.</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <ProfileCard profile={profile} />
    </div>
  )
}
