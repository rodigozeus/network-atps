import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const CHAVE = 'rolagem'
const ESPERA_MAXIMA_MS = 3000

const lerPosicoes = (): Record<string, number> => {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

const guardarPosicao = (chave: string, y: number) => {
  try {
    const p = lerPosicoes()
    p[chave] = y
    sessionStorage.setItem(CHAVE, JSON.stringify(p))
  } catch {
    // sem sessionStorage: só não lembra a posição
  }
}

/** Página nova (clique ou link) começa do topo. No "voltar" (POP), volta à posição em que a
 *  pessoa estava, esperando o conteúdo carregar (a busca, por exemplo, monta a lista depois). */
export default function RolarParaTopo() {
  const { key } = useLocation()
  const tipo = useNavigationType()

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  // guarda a posição desta entrada do histórico enquanto a pessoa rola
  useEffect(() => {
    let pendente = 0
    const aoRolar = () => {
      window.cancelAnimationFrame(pendente)
      pendente = window.requestAnimationFrame(() => guardarPosicao(key, window.scrollY))
    }
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => {
      window.cancelAnimationFrame(pendente)
      window.removeEventListener('scroll', aoRolar)
    }
  }, [key])

  useEffect(() => {
    if (tipo !== 'POP') {
      window.scrollTo(0, 0)
      return
    }
    const alvo = lerPosicoes()[key]
    if (!alvo) return
    const inicio = performance.now()
    let quadro = 0
    const tentar = () => {
      const cabe = document.documentElement.scrollHeight - window.innerHeight >= alvo
      window.scrollTo(0, alvo)
      if (!cabe && performance.now() - inicio < ESPERA_MAXIMA_MS) quadro = window.requestAnimationFrame(tentar)
    }
    tentar()
    return () => window.cancelAnimationFrame(quadro)
  }, [key, tipo])

  return null
}
