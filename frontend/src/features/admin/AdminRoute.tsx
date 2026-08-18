import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'

export default function AdminRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (user?.role !== 'admin' && user?.role !== 'andeps') return <Navigate to="/" replace />

  return <Outlet />
}
