import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import Barra, { type Voltar } from './Barra'
import Rodape from './Rodape'
import styles from './Layout.module.css'

// Páginas com topo colorido de ponta a ponta: a barra começa transparente sobre elas
const comTopo = (p: string) => p === '/busca' || p.startsWith('/analistas/') || p.startsWith('/unidades')

/** Destino padrão do botão do topo, para quem chegou à página sem passar por outra da Rede (link direto). */
function voltarPadrao(p: string): Voltar | null {
  if (p.startsWith('/analistas/')) return { para: '/busca', rotulo: 'Pessoas na rede' }
  if (p === '/perfil') return { para: '/busca', rotulo: 'Pessoas na rede' }
  if (p.startsWith('/unidades/')) return { para: '/unidades', rotulo: 'Órgãos e unidades' }
  if (p === '/unidades') return { para: '/busca', rotulo: 'Pessoas na rede' }
  if (p === '/rede') return { para: '/busca', rotulo: 'Pessoas na rede' }
  return null
}

// De onde a pessoa veio, por entrada do histórico (sobrevive ao recarregar a página)
const CHAVE_ORIGENS = 'origens-voltar'
const CHAVE_TITULOS = 'titulos-paginas'

function lerMapa(chave: string): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(chave) ?? '{}') } catch { return {} }
}

function gravarMapa(chave: string, mapa: Record<string, string>) {
  try {
    const entradas = Object.entries(mapa).slice(-200)  // não cresce sem limite
    sessionStorage.setItem(chave, JSON.stringify(Object.fromEntries(entradas)))
  } catch { /* sem sessionStorage: fica o destino padrão */ }
}

/** Nome da página de origem no botão: fixo para as listas; nos perfis e unidades, o título da página. */
function rotuloDe(caminho: string): string {
  const p = caminho.split('?')[0]
  if (p === '/busca') return 'Pessoas na rede'
  if (p === '/unidades') return 'Órgãos e unidades'
  if (p === '/rede') return 'Minha rede'
  if (p === '/perfil') return 'Meu perfil'
  const titulo = lerMapa(CHAVE_TITULOS)[p]?.replace(/\s*·\s*Rede ATPS$/, '').trim()
  if (titulo && titulo !== 'Rede ATPS') return titulo
  return p.startsWith('/unidades/') ? 'Unidade' : p.startsWith('/analistas/') ? 'Perfil' : 'Voltar'
}

export default function Layout() {
  const local = useLocation()
  const tipoNavegacao = useNavigationType()
  const { pathname } = local
  const isAdmin = pathname.startsWith('/admin')
  const anterior = useRef<string | null>(null)
  const [, redesenhar] = useState(0)

  // Guarda o título de cada página (perfis e unidades definem o título quando os dados chegam)
  useEffect(() => {
    const guardar = () => {
      const t = lerMapa(CHAVE_TITULOS)
      t[pathname] = document.title
      gravarMapa(CHAVE_TITULOS, t)
    }
    guardar()
    const titulo = document.querySelector('title')
    if (!titulo) return
    const obs = new MutationObserver(guardar)
    obs.observe(titulo, { childList: true, characterData: true, subtree: true })
    return () => obs.disconnect()
  }, [pathname])

  // Ao entrar numa página clicando em algo da Rede, anota de onde veio
  useEffect(() => {
    const atual = local.pathname + local.search
    const veioDe = anterior.current
    // subir pelo botão do topo não cria origem: senão a página de cima apontaria de volta para a de
    // baixo, e as duas ficariam se apontando (unidade -> lista -> unidade...)
    const viaVoltar = (local.state as { viaVoltar?: boolean } | null)?.viaVoltar
    if (tipoNavegacao === 'PUSH' && !viaVoltar && veioDe && veioDe.split('?')[0] !== local.pathname) {
      const origens = lerMapa(CHAVE_ORIGENS)
      origens[local.key] = veioDe
      gravarMapa(CHAVE_ORIGENS, origens)
      redesenhar((n) => n + 1)  // o botão do topo passa a mostrar a origem
    }
    anterior.current = atual
  }, [local.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const padrao = voltarPadrao(pathname)
  const origem = padrao ? lerMapa(CHAVE_ORIGENS)[local.key] : undefined
  // veio de outra página da Rede: o botão volta no histórico (mesmo lugar, mesma rolagem)
  const voltar: Voltar | null = origem ? { para: origem, rotulo: rotuloDe(origem), historico: true } : padrao

  return (
    <div className={styles.page}>
      <Barra voltar={voltar} />
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
