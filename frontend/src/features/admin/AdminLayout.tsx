import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { api } from '@shared/api/client'
import styles from './admin.module.css'

export default function AdminLayout() {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    api
      .get<{ total: number }>('/admin/usuarios', { params: { pendente_revisao: true, page_size: 1 } })
      .then(({ data }) => setPendingCount(data.total))
      .catch(() => {})
  }, [])

  return (
    <div className={styles.adminPage}>
      <aside className={styles.sidebar}>
        <p className={styles.sidebarTitle}>Painel Admin</p>
        <nav className={styles.sidebarNav}>
          <NavLink
            to="/admin/usuarios"
            className={({ isActive }) =>
              [styles.sidebarLink, isActive ? styles.sidebarLinkActive : ''].filter(Boolean).join(' ')
            }
          >
            Usuários
          </NavLink>
          <NavLink
            to="/admin/stats"
            className={({ isActive }) =>
              [styles.sidebarLink, isActive ? styles.sidebarLinkActive : ''].filter(Boolean).join(' ')
            }
          >
            Estatísticas
          </NavLink>
          <NavLink
            to="/admin/configuracoes"
            className={({ isActive }) =>
              [styles.sidebarLink, isActive ? styles.sidebarLinkActive : ''].filter(Boolean).join(' ')
            }
          >
            Configurações
          </NavLink>
        </nav>
      </aside>
      <div className={styles.adminContent}>
        {pendingCount > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--r)', padding: 'var(--sp-3) var(--sp-5)', color: '#92400e', fontSize: 'var(--font-sm)', marginBottom: 'var(--sp-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
            <span>
              <strong>{pendingCount}</strong>{' '}
              {pendingCount === 1 ? 'cadastro aguarda' : 'cadastros aguardam'} revisão manual.
            </span>
            <Link to="/admin/usuarios" style={{ color: '#92400e', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
              Ver agora
            </Link>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  )
}
