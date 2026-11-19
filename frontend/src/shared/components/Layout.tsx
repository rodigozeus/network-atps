import { Outlet, useLocation } from 'react-router-dom'
import Barra, { type Voltar } from './Barra'
import Rodape from './Rodape'
import styles from './Layout.module.css'

// Páginas com topo colorido de ponta a ponta: a barra começa transparente sobre elas
const comTopo = (p: string) => p === '/busca' || p.startsWith('/analistas/') || p.startsWith('/unidades')

function voltarPara(p: string): Voltar | null {
  if (p.startsWith('/analistas/')) return { para: '/busca', rotulo: 'Pessoas na rede' }
  if (p === '/perfil') return { para: '/busca', rotulo: 'Pessoas na rede' }
  if (p.startsWith('/unidades/')) return { para: '/unidades', rotulo: 'Órgãos e unidades' }
  if (p === '/unidades') return { para: '/busca', rotulo: 'Pessoas na rede' }
  return null
}

export default function Layout() {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <div className={styles.page}>
      <Barra voltar={voltarPara(pathname)} />
      {comTopo(pathname) ? (
        <main className={styles.mainTopo}>
          <Outlet />
        </main>
      ) : (
        <main className={styles.main} data-barra-limite>
          <div className={isAdmin ? styles.containerWide : styles.container}>
            <Outlet />
          </div>
        </main>
      )}
      <Rodape />
    </div>
  )
}
