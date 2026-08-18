import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buscaApi } from '@shared/api/busca'
import type { AnalistaPublico } from '@shared/api/types'
import { Spinner, Button, Input } from '@shared/components'
import BuscaResultCard from './BuscaResultCard'
import styles from './busca.module.css'

const PAGE_SIZE = 20

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [formQ, setFormQ] = useState(searchParams.get('q') ?? '')
  const [formMin, setFormMin] = useState(searchParams.get('ministerio') ?? '')
  const [formSec, setFormSec] = useState(searchParams.get('secretaria') ?? '')
  const [formTema, setFormTema] = useState(searchParams.get('tema') ?? '')
  const [formForm, setFormForm] = useState(searchParams.get('formacao') ?? '')

  const [items, setItems] = useState<AnalistaPublico[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Sync form inputs when URL changes (browser back/forward or shared URL)
  useEffect(() => {
    setFormQ(searchParams.get('q') ?? '')
    setFormMin(searchParams.get('ministerio') ?? '')
    setFormSec(searchParams.get('secretaria') ?? '')
    setFormTema(searchParams.get('tema') ?? '')
    setFormForm(searchParams.get('formacao') ?? '')
  }, [searchParams])

  // Reset and fetch page 1 whenever filters change
  useEffect(() => {
    setLoading(true)
    setError(null)
    setItems([])
    setPage(1)
    buscaApi
      .buscar({
        q: searchParams.get('q') ?? undefined,
        ministerio: searchParams.get('ministerio') ?? undefined,
        secretaria: searchParams.get('secretaria') ?? undefined,
        tema: searchParams.get('tema') ?? undefined,
        formacao: searchParams.get('formacao') ?? undefined,
        page: 1,
        page_size: PAGE_SIZE,
      })
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
        setHasMore(data.page < data.pages)
      })
      .catch(() => setError('Erro ao buscar analistas. Tente novamente.'))
      .finally(() => setLoading(false))
  }, [searchParams])

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1
    setLoadingMore(true)
    buscaApi
      .buscar({
        q: searchParams.get('q') ?? undefined,
        ministerio: searchParams.get('ministerio') ?? undefined,
        secretaria: searchParams.get('secretaria') ?? undefined,
        tema: searchParams.get('tema') ?? undefined,
        formacao: searchParams.get('formacao') ?? undefined,
        page: nextPage,
        page_size: PAGE_SIZE,
      })
      .then((data) => {
        setPage(nextPage)
        setItems((prev) => {
          const seenIds = new Set(prev.map((i) => i.id))
          return [...prev, ...data.items.filter((i) => !seenIds.has(i.id))]
        })
        setHasMore(data.page < data.pages)
      })
      .catch(() => setError('Erro ao carregar mais analistas.'))
      .finally(() => setLoadingMore(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, loadingMore, hasMore, searchParams])

  // Carrega mais quando o sentinel entra na viewport
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoadMore() },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleLoadMore])

  function buildParams(): Record<string, string> {
    const p: Record<string, string> = {}
    if (formQ) p.q = formQ
    if (formMin) p.ministerio = formMin
    if (formSec) p.secretaria = formSec
    if (formTema) p.tema = formTema
    if (formForm) p.formacao = formForm
    return p
  }

  function applyFilters() {
    setSearchParams(buildParams(), { replace: true })
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    applyFilters()
  }

  function handleFilterBlur() {
    applyFilters()
  }

  function handleFilterKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') applyFilters()
  }

  function handleClearFilters() {
    setFormQ('')
    setFormMin('')
    setFormSec('')
    setFormTema('')
    setFormForm('')
    setSearchParams({}, { replace: true })
  }

  const hasActiveFilters =
    !!(searchParams.get('q') ||
      searchParams.get('ministerio') ||
      searchParams.get('secretaria') ||
      searchParams.get('tema') ||
      searchParams.get('formacao'))
  const activeFilterCount = [formMin, formSec, formTema, formForm].filter(Boolean).length

  return (
    <div className={styles.page}>
      <form className={styles.searchBar} onSubmit={handleSearchSubmit}>
        <div className={styles.searchInput}>
          <Input
            value={formQ}
            onChange={(e) => setFormQ(e.target.value)}
            placeholder="Buscar por nome, ministério, secretaria ou tema..."
          />
        </div>
        <Button type="submit" variant="primary">
          Buscar
        </Button>
        {hasActiveFilters && (
          <Button type="button" variant="outline" onClick={handleClearFilters}>
            Limpar
          </Button>
        )}
        <button
          type="button"
          className={[styles.filterToggle, filtersOpen ? styles.filterToggleActive : ''].filter(Boolean).join(' ')}
          onClick={() => setFiltersOpen((o) => !o)}
        >
          {filtersOpen ? 'Fechar filtros' : `Filtros${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
        </button>
      </form>

      <div className={styles.layout}>
        <aside className={[styles.sidebar, filtersOpen ? styles.sidebarOpen : ''].filter(Boolean).join(' ')}>
          <p className={styles.sidebarTitle}>Filtros</p>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Ministério</label>
            <input
              className={styles.filterInput}
              value={formMin}
              onChange={(e) => setFormMin(e.target.value)}
              onBlur={handleFilterBlur}
              onKeyDown={handleFilterKeyDown}
              placeholder="Ex.: MEC, Fazenda…"
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Secretaria</label>
            <input
              className={styles.filterInput}
              value={formSec}
              onChange={(e) => setFormSec(e.target.value)}
              onBlur={handleFilterBlur}
              onKeyDown={handleFilterKeyDown}
              placeholder="Ex.: SAF, STN…"
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Tema de Atuação</label>
            <input
              className={styles.filterInput}
              value={formTema}
              onChange={(e) => setFormTema(e.target.value)}
              onBlur={handleFilterBlur}
              onKeyDown={handleFilterKeyDown}
              placeholder="Ex.: orçamento, gestão…"
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Formação</label>
            <input
              className={styles.filterInput}
              value={formForm}
              onChange={(e) => setFormForm(e.target.value)}
              onBlur={handleFilterBlur}
              onKeyDown={handleFilterKeyDown}
              placeholder="Ex.: Direito, UnB…"
            />
          </div>
        </aside>

        <div className={styles.results}>
          {loading ? (
            <div className={styles.center}>
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <div className={styles.center}>
              <p className={styles.errorText}>{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>Nenhum analista encontrado</p>
              <p className={styles.emptySub}>Tente ajustar os filtros ou o termo de busca.</p>
            </div>
          ) : (
            <>
              <div className={styles.resultsHeader}>
                <span className={styles.resultsCount}>
                  {total}{' '}
                  {total === 1 ? 'analista encontrado' : 'analistas encontrados'}
                </span>
              </div>

              <div className={styles.grid}>
                {items.map((a) => (
                  <BuscaResultCard key={a.id} analista={a} />
                ))}
              </div>

              {hasMore && (
                <div ref={sentinelRef} className={styles.loadMore}>
                  {loadingMore && <Spinner size="sm" />}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
