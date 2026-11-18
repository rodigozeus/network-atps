import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { Spinner } from '@shared/components'
import RegularizacaoPage from './RegularizacaoPage'

export default function PrivateRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-16)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Pendências (CPF, novos termos, vínculo suspenso) bloqueiam as páginas internas.
  if (user && user.pendencias.length > 0) return <RegularizacaoPage />

  return <Outlet />
}
