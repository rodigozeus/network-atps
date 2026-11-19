import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@features/auth/AuthContext'
import Layout from '@shared/components/Layout'
import RolarParaTopo from '@shared/components/RolarParaTopo'
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
import ConflitosPage from '@features/admin/conflitos/ConflitosPage'
import CoberturaPage from '@features/admin/cobertura/CoberturaPage'
import TemasPage from '@features/admin/temas/TemasPage'
import AcessosPage from '@features/admin/acessos/AcessosPage'
import UnidadesPage from '@features/unidades/UnidadesPage'
import UnidadePage from '@features/unidades/UnidadePage'
import SobrePage from '@features/sobre/SobrePage'
import MinhaRedePage from '@features/rede/MinhaRedePage'

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
      <RolarParaTopo />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registrar" element={<RegisterPage />} />
          <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/sobre" element={<SobrePage />} />

          {/* Páginas internas: quem tem pendência cadastral vê a regularização em tela cheia */}
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/busca" replace />} />
              <Route path="/busca" element={<SearchPage />} />
              <Route path="/analistas/:id" element={<PublicProfilePage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/rede" element={<MinhaRedePage />} />
              <Route path="/unidades" element={<UnidadesPage />} />
              <Route path="/unidades/:id" element={<UnidadePage />} />

              <Route element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
                  <Route path="/admin/usuarios" element={<UsuariosPage />} />
                  <Route path="/admin/stats" element={<StatsPage />} />
                  <Route path="/admin/conflitos" element={<ConflitosPage />} />
                  <Route path="/admin/cobertura" element={<CoberturaPage />} />
                  <Route path="/admin/temas" element={<TemasPage />} />
                  <Route path="/admin/acessos" element={<AcessosPage />} />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route element={<Layout />}>
            <Route
              path="*"
              element={<PlaceholderPage title="Página não encontrada" desc="404" />}
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
