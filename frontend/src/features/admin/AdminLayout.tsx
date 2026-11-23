import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import type { PendenciasAdmin } from './api/admin'
import { getPendencias } from './api/admin'
import styles from './admin.module.css'

export interface AdminContexto {
  pendencias: PendenciasAdmin | null
  recarregarPendencias: () => void
}

/** Pendências do admin (contadores do menu), compartilhadas com as páginas. */
export function useAdmin() {
  return useOutletContext<AdminContexto>()
}

interface Item {
  to: string
  rotulo: string
  contador?: number
  soAdmin?: boolean
}

export default function AdminLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [pendencias, setPendencias] = useState<PendenciasAdmin | null>(null)

  const recarregarPendencias = useCallback(() => {
    getPendencias().then(setPendencias).catch(() => {})
  }, [])

  // ao trocar de página: o admin pode ter acabado de aprovar, resolver ou revisar algo
  useEffect(recarregarPendencias, [pathname, recarregarPendencias])

  const p = pendencias
  const grupos: { titulo: string; itens: Item[] }[] = [
    {
      titulo: 'Acompanhar',
      itens: [
        { to: '/admin/stats', rotulo: 'Estatísticas' },
        { to: '/admin/cobertura', rotulo: 'Cobertura' },
        { to: '/admin/acessos', rotulo: 'Acessos', soAdmin: true },
      ],
    },
    {
      titulo: 'Gerenciar',
      itens: [
        { to: '/admin/usuarios', rotulo: 'Usuários', contador: p ? p.revisao + p.vinculo : 0 },
        { to: '/admin/conflitos', rotulo: 'Conflitos de CPF', contador: p?.conflitos },
        { to: '/admin/temas', rotulo: 'Temas', contador: p?.temas },
      ],
    },
  ]

  return (
    <div className={styles.adminPage}>
      <aside className={styles.sidebar}>
        <p className={styles.sidebarTitle}>Painel Admin</p>
        {grupos.map((g) => (
          <nav key={g.titulo} className={styles.sidebarGrupo} aria-label={g.titulo}>
            <p className={styles.sidebarGrupoTitulo}>{g.titulo}</p>
            <div className={styles.sidebarNav}>
              {g.itens
                .filter((i) => !i.soAdmin || user?.role === 'admin')
                .map((i) => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    className={({ isActive }) =>
                      [styles.sidebarLink, isActive ? styles.sidebarLinkActive : ''].filter(Boolean).join(' ')
                    }
                  >
                    <span>{i.rotulo}</span>
                    {!!i.contador && (
                      <span className={styles.sidebarContador} aria-label={`${i.contador} pendente(s)`}>
                        {i.contador}
                      </span>
                    )}
                  </NavLink>
                ))}
            </div>
          </nav>
        ))}
      </aside>
      <div className={styles.adminContent}>
        <Outlet context={{ pendencias, recarregarPendencias } satisfies AdminContexto} />
      </div>
    </div>
  )
}
