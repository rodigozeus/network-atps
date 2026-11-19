import { Link } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'
import { useAuth } from '@shared/hooks/useAuth'
import { LogoHorizontal } from './Logo'
import MenuConta from './MenuConta'
import Andeps from './Andeps'
import styles from './Barra.module.css'

export interface Voltar {
  para: string
  rotulo: string
}

/** Barra fixa do topo, sempre laranja e com a logo. */
export default function Barra({ voltar }: { voltar: Voltar | null }) {
  const { isAuthenticated, isLoading } = useAuth()
  // sempre sólida (laranja, com a logo); antes ficava transparente sobre os topos coloridos
  const solida = true

  return (
    <header className={[styles.barra, solida ? styles.solida : ''].join(' ')}>
      <div className={styles.inner}>
        <div className={styles.esquerda}>
          {voltar && (
            <Link to={voltar.para} className={styles.voltar} aria-label={`Voltar para ${voltar.rotulo}`}>
              <IconArrowLeft size={18} aria-hidden />
              <span>{voltar.rotulo}</span>
            </Link>
          )}
          <Link to="/busca" className={styles.logo} aria-label="Rede ATPS, ir para a busca" tabIndex={solida ? 0 : -1}>
            <LogoHorizontal />
          </Link>
          <span className={styles.divisor} aria-hidden />
          <Andeps className={styles.andeps} altura={20} />
        </div>
        {!isLoading && (isAuthenticated ? <MenuConta /> : <Link to="/login" className={styles.entrar}>Entrar</Link>)}
      </div>
    </header>
  )
}
