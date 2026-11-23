import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AnalistaAdminOut, ListUsuariosParams } from '../api/admin'
import { confirmarVinculo, desativarUsuario, downloadCSV, excluirUsuario, getUsuarios, reativarUsuario } from '../api/admin'
import EditarUsuarioModal from './EditarUsuarioModal'
import styles from '../admin.module.css'
import { useAuth } from '@shared/hooks/useAuth'
import { useAdmin } from '../AdminLayout'

const PAGE_SIZE = 20

type FiltroAtivo = 'todos' | 'ativos' | 'inativos' | 'pendentes' | 'vinculo'
const FILTROS: FiltroAtivo[] = ['todos', 'ativos', 'inativos', 'pendentes', 'vinculo']

/** Filtros que chegam pela URL, vindos dos gráficos e das pendências das estatísticas */
type FiltroExtra = Pick<ListUsuariosParams, 'orgao_id' | 'tema_id' | 'nivel' | 'turma' | 'sem' | 'bloqueado'>

function lerFiltroExtra(p: URLSearchParams): FiltroExtra | null {
  const f: FiltroExtra = {}
  if (p.get('orgao_id')) f.orgao_id = Number(p.get('orgao_id'))
  if (p.get('tema_id')) f.tema_id = Number(p.get('tema_id'))
  if (p.get('nivel')) f.nivel = p.get('nivel')!
  if (p.get('turma')) f.turma = p.get('turma')!
  if (p.get('sem')) f.sem = p.get('sem')!
  if (p.get('bloqueado')) f.bloqueado = true
  return Object.keys(f).length ? f : null
}

export default function UsuariosPage() {
  const { user } = useAuth()
  const { recarregarPendencias } = useAdmin()
  const isAdmin = user?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const chaveParams = params.toString()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const extra = useMemo(() => lerFiltroExtra(params), [chaveParams])
  const tituloExtra = params.get('titulo')
  const filtroUrl = params.get('filtro') as FiltroAtivo | null
  const [items, setItems] = useState<AnalistaAdminOut[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>(
    filtroUrl && FILTROS.includes(filtroUrl) ? filtroUrl : extra ? 'ativos' : 'pendentes',
  )
  const [loading, setLoading] = useState(false)
  const [editando, setEditando] = useState<AnalistaAdminOut | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // só troca sozinho de "Ag. revisão" para "Ativos" quando ninguém pediu um filtro pela URL
  const autoSwitchDone = useRef(!!filtroUrl || !!extra)

  const fetch = useCallback(async (currentPage: number, query: string, filtro: FiltroAtivo) => {
    setLoading(true)
    try {
      const base = { ...extra, q: query || undefined, page: currentPage, page_size: PAGE_SIZE }
      const params =
        filtro === 'pendentes'
          ? { ...base, pendente_revisao: true }
          : filtro === 'vinculo'
            ? { ...base, alerta_vinculo: true }
            : { ...base, ativo: filtro === 'todos' ? undefined : filtro === 'ativos' }
      const data = await getUsuarios(params)
      if (!autoSwitchDone.current && filtro === 'pendentes' && data.total === 0) {
        autoSwitchDone.current = true
        setFiltroAtivo('ativos')
        return
      }
      autoSwitchDone.current = true
      setItems(data.items)
      setTotal(data.total)
      setPages(data.pages)
    } finally {
      setLoading(false)
    }
  }, [extra])

  function limparFiltroExtra() {
    setParams({}, { replace: true })
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      void fetch(1, q, filtroAtivo)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, filtroAtivo, fetch])

  useEffect(() => {
    void fetch(page, q, filtroAtivo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function handleToggleAtivo(analista: AnalistaAdminOut) {
    try {
      if (analista.ativo) {
        await desativarUsuario(analista.id)
      } else {
        const updated = await reativarUsuario(analista.id)
        recarregarPendencias()
        setItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
        return
      }
      setItems((prev) => prev.map((a) => (a.id === analista.id ? { ...a, ativo: !a.ativo } : a)))
    } catch {
      // silencioso — backend retorna 400 se tentar desativar a si mesmo
    }
  }

  async function handleExcluir(analista: AnalistaAdminOut) {
    if (!window.confirm(`Excluir permanentemente o perfil de "${analista.nome}"? Esta ação não pode ser desfeita.`)) return
    try {
      await excluirUsuario(analista.id)
      setItems((prev) => prev.filter((a) => a.id !== analista.id))
      setTotal((t) => t - 1)
    } catch {
      // silencioso — backend retorna erro se sem permissão
    }
  }

  function handleSaved(updated: AnalistaAdminOut) {
    setItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    setEditando(null)
  }

  async function handleConfirmarVinculo(analista: AnalistaAdminOut) {
    if (!window.confirm(`Confirmar manualmente o vínculo de "${analista.nome}" com a carreira? A reverificação automática não suspenderá mais esta conta.`)) return
    try {
      const updated = await confirmarVinculo(analista.id)
      recarregarPendencias()
      setItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    } catch {
      // silencioso — mantém o item como está
    }
  }

  function temAlertaVinculo(a: AnalistaAdminOut) {
    return a.vinculo_suspenso_em !== null || (a.ativo && a.motivo_pendencia !== null)
  }

  function statusBadge(a: AnalistaAdminOut) {
    if (a.vinculo_suspenso_em) {
      const exclusao = a.vinculo_exclusao_em ? new Date(a.vinculo_exclusao_em).toLocaleDateString('pt-BR') : ''
      return (
        <span className={styles.badgeInativo} title={`${a.motivo_pendencia ?? ''} Exclusão automática em ${exclusao}.`}>
          Vínculo suspenso
        </span>
      )
    }
    if (a.ativo && a.motivo_pendencia) {
      return <span className={styles.badgePendente} title={a.motivo_pendencia}>Alerta de vínculo</span>
    }
    if (a.pendente_revisao) {
      return (
        <span
          className={styles.badgePendente}
          title={a.motivo_pendencia ?? 'Vínculo como ATPS não confirmado automaticamente no Portal da Transparência'}
        >
          Ag. revisão
        </span>
      )
    }
    return (
      <span className={a.ativo ? styles.badgeAtivo : styles.badgeInativo}>
        {a.ativo ? 'Ativo' : 'Inativo'}
      </span>
    )
  }

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Usuários ({total})</h1>
        <div className={styles.toolbar}>
          <input
            className={styles.searchInput}
            placeholder="Buscar por nome ou email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className={styles.filterSelect}
            value={filtroAtivo}
            onChange={(e) => setFiltroAtivo(e.target.value as FiltroAtivo)}
          >
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="pendentes">Ag. revisão</option>
            <option value="vinculo">Alertas de vínculo</option>
            <option value="todos">Todos</option>
          </select>
          <button
            onClick={downloadCSV}
            style={{ padding: '8px 16px', borderRadius: 'var(--r)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 'var(--font-sm)', fontWeight: 500 }}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {extra && (
        <div className={styles.filtroExtra}>
          <span>Filtro das estatísticas: <strong>{tituloExtra ?? 'personalizado'}</strong></span>
          <button type="button" onClick={limparFiltroExtra} aria-label="Remover filtro">Remover filtro ✕</button>
        </div>
      )}

      {loading ? (
        <p className={styles.empty}>Carregando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Nenhum analista encontrado.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email pessoal</th>
                <th>Ministério</th>
                <th>Role</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className={a.pendente_revisao ? styles.rowPendente : undefined}>
                  <td>{a.nome}</td>
                  <td>{a.email_pessoal}</td>
                  <td>{a.ministerio_sigla ?? a.ministerio ?? '—'}</td>
                  <td>
                    <span className={a.role === 'admin' ? styles.badgeAdmin : styles.badgeAnalista}>
                      {a.role}
                    </span>
                  </td>
                  <td>{statusBadge(a)}</td>
                  <td>{new Date(a.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div className={styles.actions}>
                      {isAdmin && (
                        <button
                          onClick={() => setEditando(a)}
                          style={{ fontSize: 'var(--font-xs)', padding: '4px 10px', borderRadius: 'var(--r)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer' }}
                        >
                          Editar
                        </button>
                      )}
                      {!(user?.role === 'andeps' && a.role === 'admin') && a.id !== user?.id && (
                        <button
                          onClick={() => void handleToggleAtivo(a)}
                          style={{ fontSize: 'var(--font-xs)', padding: '4px 10px', borderRadius: 'var(--r)', border: 'none', background: a.ativo ? '#fee2e2' : '#dcfce7', color: a.ativo ? '#b91c1c' : '#15803d', cursor: 'pointer' }}
                        >
                          {a.ativo ? 'Desativar' : a.pendente_revisao ? 'Aprovar' : 'Reativar'}
                        </button>
                      )}
                      {temAlertaVinculo(a) && (
                        <button
                          onClick={() => void handleConfirmarVinculo(a)}
                          style={{ fontSize: 'var(--font-xs)', padding: '4px 10px', borderRadius: 'var(--r)', border: 'none', background: '#dcfce7', color: '#15803d', cursor: 'pointer' }}
                        >
                          Confirmar vínculo
                        </button>
                      )}
                      {isAdmin && a.id !== user?.id && (
                        <button
                          onClick={() => void handleExcluir(a)}
                          style={{ fontSize: 'var(--font-xs)', padding: '4px 10px', borderRadius: 'var(--r)', border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer' }}
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '4px 12px', borderRadius: 'var(--r)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
          >
            ← Anterior
          </button>
          <span>Página {page} de {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            style={{ padding: '4px 12px', borderRadius: 'var(--r)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: page === pages ? 'not-allowed' : 'pointer' }}
          >
            Próxima →
          </button>
        </div>
      )}

      {editando && (
        <EditarUsuarioModal
          analista={editando}
          onClose={() => setEditando(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
