import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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

/**
 * Barra fixa do topo. Sobre um topo colorido (busca, perfil) começa transparente e fica laranja,
 * com a logo, quando o conteúdo marcado com data-barra-limite chega nela.
 */
export default function Barra({ voltar }: { voltar: Voltar | null }) {
  const { isAuthenticated, isLoading } = useAuth()
  const { pathname } = useLocation()
  const [solida, setSolida] = useState(true)

  useEffect(() => {
    const atualizar = () => {
      const limite = document.querySelector('[data-barra-limite]')
      setSolida(!limite || limite.getBoundingClientRect().top <= 72)
    }
    atualizar()
    window.addEventListener('scroll', atualizar, { passive: true })
    window.addEventListener('resize', atualizar)
    // o limite pode aparecer depois que os dados carregam
    const obs = new MutationObserver(atualizar)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.removeEventListener('scroll', atualizar)
      window.removeEventListener('resize', atualizar)
      obs.disconnect()
    }
  }, [pathname])

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
