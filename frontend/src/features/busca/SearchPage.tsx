import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  IconAdjustmentsHorizontal, IconChevronDown, IconLayoutGrid, IconList, IconSearch, IconSparkles, IconStar, IconStarFilled,
} from '@tabler/icons-react'
import { buscaApi } from '@shared/api/busca'
import { favoritosApi } from '@shared/api/favoritos'
import { lotacoesApi } from '@shared/api/lotacoes'
import { temasApi } from '@shared/api/temas'
import type { AnalistaPublico, BuscaParams, NivelFormacao, OrdemBusca, TemaCatalogo } from '@shared/api/types'
import { Spinner } from '@shared/components'
import { useFavoritos } from '@shared/hooks/useFavoritos'
import { NIVEIS, ORDEM_NIVEIS } from '@shared/utils/analista'
import RedeHero from './RedeHero'
import AnalistaCard from './AnalistaCard'
import AnalistaLinha from './AnalistaLinha'
import NovidadesRede from './NovidadesRede'
import styles from './busca.module.css'

const PAGE_SIZE = 20
const ORDENS: Record<OrdemBusca, string> = {
  relevancia: 'Perfis mais completos',
  nome: 'Nome (A–Z)',
  recentes: 'Chegaram há pouco',
}
const lerOrdem = (v: string | null): OrdemBusca => (v && v in ORDENS ? (v as OrdemBusca) : 'relevancia')
type Vista = 'cards' | 'linhas'

// Resultados já carregados (com as páginas da rolagem infinita), para o "voltar" de um perfil
// mostrar a mesma lista na mesma posição, sem recarregar
const CACHE_VALIDADE_MS = 10 * 60 * 1000
let cacheLista: { chave: string; itens: AnalistaPublico[]; pagina: number; paginas: number; aproximado: boolean; em: number } | null = null

const lerVista = (): Vista => {
  try {
    return localStorage.getItem('vista') === 'linhas' ? 'linhas' : 'cards'
  } catch {
    return 'cards'
  }
}

export default function SearchPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { favoritos, novidades } = useFavoritos()

  // filtros vivem no endereço, para poder compartilhar e voltar
  const filtros = useMemo(() => ({
    q: params.get('q') ?? '',
    ministerio: params.get('ministerio') ?? '',
    tema: params.get('tema') ?? '',
    nivel: (params.get('nivel_formacao') ?? '') as NivelFormacao | '',
    soFavoritos: params.get('favoritos') === '1',
    soNovidades: params.get('novidades') === '1',
    ordem: lerOrdem(params.get('ordem')),
  }), [params])

  const [texto, setTexto] = useState(filtros.q)
  const [itens, setItens] = useState<AnalistaPublico[]>([])
  const [pagina, setPagina] = useState(1)
  const [paginas, setPaginas] = useState(1)
  const [aproximado, setAproximado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [rede, setRede] = useState<AnalistaPublico[]>([])
  const [ministerios, setMinisterios] = useState<string[]>([])
  const [temas, setTemas] = useState<TemaCatalogo[]>([])
  const [vista, setVista] = useState<Vista>(lerVista)
  const [trocouVista, setTrocouVista] = useState(0)
  const [compacto, setCompacto] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)

  const mudarFiltro = useCallback((chave: string, valor: string) => {
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (valor) n.set(chave, valor)
      else n.delete(chave)
      return n
    }, { replace: true })
  }, [setParams])

  // filtros limpos por fora (clique em "Rede ATPS"): o campo de texto acompanha
  useEffect(() => {
    setTexto((t) => (t.trim() === filtros.q ? t : filtros.q))
  }, [filtros.q])

  // busca por texto: espera a pessoa parar de digitar
  useEffect(() => {
    if (texto === filtros.q) return
    const t = window.setTimeout(() => mudarFiltro('q', texto.trim()), 350)
    return () => window.clearTimeout(t)
  }, [texto, filtros.q, mudarFiltro])

  const paramsApi = useCallback((page: number): BuscaParams => ({
    q: filtros.q || undefined,
    ministerio: filtros.ministerio || undefined,
    tema: filtros.tema || undefined,
    nivel_formacao: filtros.nivel || undefined,
    favoritos: filtros.soFavoritos || undefined,
    novidades: filtros.soNovidades || undefined,
    ordem: filtros.ordem === 'relevancia' ? undefined : filtros.ordem,
    page,
    page_size: PAGE_SIZE,
  }), [filtros])

  // primeira página sempre que os filtros mudam (ou a lista guardada, se for a mesma busca)
  useEffect(() => {
    let vivo = true
    const chave = JSON.stringify(paramsApi(1))
    if (cacheLista && cacheLista.chave === chave && Date.now() - cacheLista.em < CACHE_VALIDADE_MS) {
      setItens(cacheLista.itens)
      setPagina(cacheLista.pagina)
      setPaginas(cacheLista.paginas)
      setAproximado(cacheLista.aproximado)
      setCarregando(false)
      return () => { vivo = false }
    }
    setCarregando(true)
    setErro(null)
    buscaApi.buscar(paramsApi(1))
      .then((r) => {
        if (!vivo) return
        setItens(r.items)
        setPagina(r.page)
        setPaginas(r.pages)
        setAproximado(!!r.aproximado)
      })
      .catch(() => vivo && setErro('Não foi possível carregar as pessoas. Tente de novo.'))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [paramsApi])

  // guarda a lista atual para o "voltar"
  useEffect(() => {
    if (carregando || !itens.length) return
    const chave = JSON.stringify(paramsApi(1))
    cacheLista = { chave, itens, pagina, paginas, aproximado, em: cacheLista?.chave === chave ? cacheLista.em : Date.now() }
  }, [itens, pagina, paginas, aproximado, carregando, paramsApi])

  const carregarMais = useCallback(() => {
    if (carregandoMais || pagina >= paginas) return
    setCarregandoMais(true)
    buscaApi.buscar(paramsApi(pagina + 1))
      .then((r) => {
        setItens((atual) => [...atual, ...r.items.filter((x) => !atual.some((y) => y.id === x.id))])
        setPagina(r.page)
        setPaginas(r.pages)
      })
      .catch(() => setErro('Não foi possível carregar mais pessoas.'))
      .finally(() => setCarregandoMais(false))
  }, [carregandoMais, pagina, paginas, paramsApi])

  // rolagem infinita: carrega a próxima página quando o fim da lista aparece
  const sentinela = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinela.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) carregarMais() }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [carregarMais])

  // rede do topo e opções dos filtros: uma vez ao abrir
  useEffect(() => {
    buscaApi.buscar({ page: 1, page_size: 20 }).then((r) => {
      setRede(r.items)
      // sem GET /lotacoes no back-end, os ministérios do filtro saem das pessoas carregadas
      setMinisterios((atual) => atual.length ? atual
        : [...new Set(r.items.map((a) => a.ministerio).filter((m): m is string => !!m))].sort((a, b) => a.localeCompare(b, 'pt')))
    }).catch(() => {})
    lotacoesApi.listar('ministerio').then((l) => {
      if (l.length) setMinisterios(l.map((x) => x.nome).sort((a, b) => a.localeCompare(b, 'pt')))
    }).catch(() => {})
    temasApi.listar().then((t) => setTemas([...t].sort((a, b) => a.tema.localeCompare(b.tema, 'pt')))).catch(() => {})
  }, [])

  // Favoritos ainda sem endpoint: filtra entre as pessoas já carregadas
  const visiveis = filtros.soFavoritos && favoritosApi.emModoLocal() ? itens.filter((a) => favoritos.has(a.id)) : itens

  // Modo compacto: mede se a busca ficaria estreita demais com todos os filtros na linha
  const toolbar = useRef<HTMLDivElement>(null)
  const medirToolbar = useCallback(() => {
    const tb = toolbar.current
    if (!tb) return
    tb.dataset.medindo = 'true'
    // a busca tem largura mínima e os filtros encolhem até um limite; se mesmo assim a linha
    // transborda, os filtros vão para o painel
    const cabe = tb.scrollWidth <= tb.clientWidth + 1
    delete tb.dataset.medindo
    setCompacto(!cabe)
  }, [])
  // mede quando a largura da tela muda...
  useLayoutEffect(() => {
    const tb = toolbar.current
    if (!tb?.parentElement) return
    const ro = new ResizeObserver(medirToolbar)
    ro.observe(tb.parentElement)
    return () => ro.disconnect()
  }, [medirToolbar])
  // ...e quando muda o que está na barra (botão "Novidades" que aparece, filtro escolhido,
  // ordenação): sem isso, a linha passava do espaço e o campo de busca era espremido
  useLayoutEffect(() => {
    medirToolbar()
  }, [medirToolbar, novidades.size, filtros.ministerio, filtros.tema, filtros.nivel, filtros.soFavoritos, filtros.soNovidades, filtros.ordem, ministerios.length, temas.length])

  const ativos = [filtros.ministerio, filtros.tema, filtros.nivel].filter(Boolean).length
    + (filtros.soFavoritos ? 1 : 0) + (filtros.soNovidades ? 1 : 0)

  const trocarVista = () => {
    const nova: Vista = vista === 'cards' ? 'linhas' : 'cards'
    setVista(nova)
    setTrocouVista((n) => n + 1)
    try { localStorage.setItem('vista', nova) } catch { /* só não lembra a preferência */ }
  }

  // clique num perfil da rede: vai até o card dele, ou abre o perfil se ele não estiver na lista
  const escolher = (id: number) => {
    const alvo = document.getElementById(`analista-${id}`)
    if (!alvo) {
      navigate(`/analistas/${id}`)
      return
    }
    alvo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    alvo.classList.remove(styles.flash)
    void alvo.offsetWidth
    alvo.classList.add(styles.flash)
  }

  return (
    <>
      <RedeHero analistas={rede} onEscolher={escolher} />

      <section className={styles.lista} data-barra-limite>
        <NovidadesRede />
        <div className={styles.listaHead}>
          <div ref={toolbar} className={[styles.toolbar, compacto ? styles.compacto : '', painelAberto ? styles.abertos : ''].join(' ')}>
            <label className={styles.search}>
              <IconSearch size={20} aria-hidden />
              <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por nome, ministério, secretaria ou tema" aria-label="Buscar pessoas" />
            </label>
            <button type="button" className={[styles.filtro, styles.btnFiltros].join(' ')} aria-expanded={painelAberto}
              aria-controls="painel-filtros" onClick={() => setPainelAberto((v) => !v)}>
              <IconAdjustmentsHorizontal size={18} aria-hidden />
              <span className={styles.rotulo}>Filtros</span>
              {ativos > 0 && <span className={styles.badge}>{ativos}</span>}
            </button>
            <div className={styles.painelFiltros} id="painel-filtros">
              <label className={styles.select}>
                <select value={filtros.ministerio} onChange={(e) => mudarFiltro('ministerio', e.target.value)}
                  aria-label="Filtrar por órgão" className={filtros.ministerio ? styles.ativo : ''}>
                  <option value="">Todos os órgãos</option>
                  {ministerios.map((m) => <option key={m} value={m}>{m}</option>)}
                  {filtros.ministerio && !ministerios.includes(filtros.ministerio) && <option value={filtros.ministerio}>{filtros.ministerio}</option>}
                </select>
                <IconChevronDown size={18} aria-hidden />
              </label>
              <label className={styles.select}>
                <select value={filtros.tema} onChange={(e) => mudarFiltro('tema', e.target.value)}
                  aria-label="Filtrar por tema" className={filtros.tema ? styles.ativo : ''}>
                  <option value="">Todos os temas</option>
                  {([['area', 'Áreas de política'], ['ferramenta', 'Ferramentas e métodos']] as const).map(([tipo, rotulo]) => (
                    <optgroup key={tipo} label={rotulo}>
                      {temas.filter((t) => (t.tipo ?? 'area') === tipo).map((t) => <option key={t.tema} value={t.tema}>{t.tema}</option>)}
                    </optgroup>
                  ))}
                  {filtros.tema && !temas.some((t) => t.tema === filtros.tema) && <option value={filtros.tema}>{filtros.tema}</option>}
                </select>
                <IconChevronDown size={18} aria-hidden />
              </label>
              <label className={styles.select}>
                <select value={filtros.nivel} onChange={(e) => mudarFiltro('nivel_formacao', e.target.value)}
                  aria-label="Filtrar por formação" className={filtros.nivel ? styles.ativo : ''}>
                  <option value="">Toda formação</option>
                  {ORDEM_NIVEIS.map((n) => <option key={n} value={n}>{NIVEIS[n]}</option>)}
                </select>
                <IconChevronDown size={18} aria-hidden />
              </label>
              <button type="button" className={styles.filtro} aria-pressed={filtros.soFavoritos}
                onClick={() => mudarFiltro('favoritos', filtros.soFavoritos ? '' : '1')}>
                {filtros.soFavoritos ? <IconStarFilled size={18} aria-hidden /> : <IconStar size={18} aria-hidden />}
                Favoritos
              </button>
              {(novidades.size > 0 || filtros.soNovidades) && (
                <button type="button" className={styles.filtro} aria-pressed={filtros.soNovidades}
                  title="Favoritos que mudaram de lotação, tema ou formação desde a sua última visita"
                  onClick={() => mudarFiltro('novidades', filtros.soNovidades ? '' : '1')}>
                  <IconSparkles size={18} aria-hidden />
                  Novidades
                  {novidades.size > 0 && <span className={styles.badgeClaro}>{novidades.size}</span>}
                </button>
              )}
              <label className={[styles.select, styles.ordem].join(' ')}>
                <select value={filtros.ordem} onChange={(e) => mudarFiltro('ordem', e.target.value === 'relevancia' ? '' : e.target.value)}
                  aria-label="Ordenar por" title={filtros.ordem === 'recentes' ? 'Quem entrou na Rede há menos tempo' : 'Seus favoritos aparecem primeiro'}>
                  {(Object.keys(ORDENS) as OrdemBusca[]).map((o) => <option key={o} value={o}>{ORDENS[o]}</option>)}
                </select>
                <IconChevronDown size={18} aria-hidden />
              </label>
            </div>
            <button type="button" className={styles.vistaBtn} onClick={trocarVista} data-trocou={trocouVista % 2}
              aria-label={vista === 'cards' ? 'Ver em lista' : 'Ver em cards'} title={vista === 'cards' ? 'Ver em lista' : 'Ver em cards'}>
              {vista === 'cards' ? <IconList size={21} aria-hidden /> : <IconLayoutGrid size={21} aria-hidden />}
            </button>
          </div>
        </div>

        {carregando ? (
          <div className={styles.carregando}><Spinner size="lg" /></div>
        ) : erro && !visiveis.length ? (
          <p className={styles.empty}>{erro}</p>
        ) : !visiveis.length ? (
          <p className={styles.empty}>{filtros.soNovidades ? 'Nenhum favorito com novidades no momento.' : 'Nenhuma pessoa encontrada para essa busca.'}</p>
        ) : (
          <>
          {aproximado && (
            <p className={styles.aproximado} role="status">
              Ninguém com “{filtros.q}”. Mostrando resultados parecidos.
            </p>
          )}
          {vista === 'cards' ? (
          <div className={styles.grid}>{visiveis.map((a) => <AnalistaCard key={a.id} a={a} />)}</div>
        ) : (
          <div className={styles.linhas}>{visiveis.map((a) => <AnalistaLinha key={a.id} a={a} />)}</div>
          )}
          </>
        )}

        <div ref={sentinela} />
        {carregandoMais && <div className={styles.carregando}><Spinner /></div>}
        {!carregando && pagina < paginas && !carregandoMais && (
          <div className={styles.maisWrap}>
            <button type="button" className={styles.filtro} onClick={carregarMais}>Carregar mais pessoas</button>
          </div>
        )}
      </section>
    </>
  )
}
