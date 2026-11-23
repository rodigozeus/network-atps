import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'
import { useAuth } from '@shared/hooks/useAuth'
import { LogoHorizontal } from './Logo'
import MenuConta from './MenuConta'
import Andeps from './Andeps'
import styles from './Barra.module.css'

export interface Voltar {
  para: string
  rotulo: string
  /** a página anterior no histórico é `para`: voltar pelo histórico (mantém a rolagem e o estado) */
  historico?: boolean
}

/**
 * Barra fixa do topo. Sobre um topo colorido (busca, perfil) começa transparente e fica laranja,
 * com a logo, quando o conteúdo marcado com data-barra-limite chega nela.
 */
export default function Barra({ voltar }: { voltar: Voltar | null }) {
  const { isAuthenticated, isLoading } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // 0 = transparente sobre o topo colorido, 1 = barra laranja completa. Cresce aos poucos com a
  // rolagem para a cor não trocar de uma vez (no perfil o topo tem a cor do órgão, não laranja).
  const [progresso, setProgresso] = useState(1)
  const solida = progresso >= 0.98

  useEffect(() => {
    const atualizar = () => {
      const limite = document.querySelector('[data-barra-limite]')
      if (!limite) { setProgresso(1); return }
      // transparente com a página no topo; laranja completo quando o conteúdo chega à barra
      const rolagemAteBarra = limite.getBoundingClientRect().top + window.scrollY - 72
      setProgresso(rolagemAteBarra <= 0 ? 1 : Math.min(1, Math.max(0, window.scrollY / rolagemAteBarra)))
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
    <header className={[styles.barra, solida ? styles.solida : ''].join(' ')}
      style={{ '--progresso': progresso } as CSSProperties}>
      <div className={styles.inner}>
        <div className={styles.esquerda}>
          {voltar && (
            <Link to={voltar.para} className={styles.voltar} aria-label={`Voltar para ${voltar.rotulo}`}
              onClick={(e) => {
                if (!voltar.historico || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                e.preventDefault()
                navigate(-1)
              }}>
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
