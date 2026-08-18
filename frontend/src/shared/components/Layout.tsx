import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import styles from './Layout.module.css'

export default function Layout() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.container}>
          <Link to="/" className={styles.brand}>
            <span className={styles.brandName}>Rede ATPS</span>
          </Link>

          <nav className={styles.nav}>
            <NavLink
              to="/busca"
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.navActive : ''].filter(Boolean).join(' ')
              }
            >
              Buscar
            </NavLink>
            {isAuthenticated && (
              <NavLink
                to="/perfil"
                className={({ isActive }) =>
                  [styles.navLink, isActive ? styles.navActive : ''].filter(Boolean).join(' ')
                }
              >
                Meu Perfil
              </NavLink>
            )}
            {(user?.role === 'admin' || user?.role === 'andeps') && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  [styles.navLink, isActive ? styles.navActive : ''].filter(Boolean).join(' ')
                }
              >
                Admin
              </NavLink>
            )}
          </nav>

          <div className={styles.actions}>
            {!isLoading && isAuthenticated && user ? (
              <>
                <span className={styles.userName}>{user.nome.split(' ')[0]}</span>
                <button className={styles.logoutBtn} onClick={handleLogout}>
                  Sair
                </button>
              </>
            ) : !isLoading ? (
              <Link to="/login" className={styles.loginLink}>
                Entrar
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={isAdmin ? styles.containerWide : styles.container}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
