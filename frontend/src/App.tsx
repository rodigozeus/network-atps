import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@features/auth/AuthContext'
import Layout from '@shared/components/Layout'
import LoginPage from '@features/auth/LoginPage'
import RegisterPage from '@features/auth/RegisterPage'
import ForgotPasswordPage from '@features/auth/ForgotPasswordPage'
import ResetPasswordPage from '@features/auth/ResetPasswordPage'
import PrivateRoute from '@features/auth/PrivateRoute'
import ProfilePage from '@features/perfil/ProfilePage'
import PublicProfilePage from '@features/perfil/PublicProfilePage'
import SearchPage from '@features/busca/SearchPage'
import AdminRoute from '@features/admin/AdminRoute'
import AdminLayout from '@features/admin/AdminLayout'
import UsuariosPage from '@features/admin/usuarios/UsuariosPage'
import StatsPage from '@features/admin/stats/StatsPage'

function PlaceholderPage({ title, desc }: { title: string; desc?: string }) {
  return (
    <div style={{ padding: 'var(--sp-10)', textAlign: 'center' }}>
      <h2 style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--sp-2)' }}>{title}</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
        {desc ?? 'Em construção — disponível na próxima fase'}
      </p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registrar" element={<RegisterPage />} />
          <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

          <Route element={<Layout />}>
            <Route index element={<Navigate to="/busca" replace />} />
            <Route
              path="*"
              element={<PlaceholderPage title="Página não encontrada" desc="404" />}
            />

            <Route element={<PrivateRoute />}>
              <Route path="/busca" element={<SearchPage />} />
              <Route path="/analistas/:id" element={<PublicProfilePage />} />
              <Route path="/perfil" element={<ProfilePage />} />
            </Route>

            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
                <Route path="/admin/usuarios" element={<UsuariosPage />} />
                <Route path="/admin/stats" element={<StatsPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
