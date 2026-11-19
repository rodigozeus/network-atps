import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '@shared/components'
import { useAuth } from '@shared/hooks/useAuth'
import type { Acesso } from '../api/admin'
import { getAcessos } from '../api/admin'
import styles from '../admin.module.css'

const POR_PAGINA = 100
const QUANDO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

/** Log dos últimos acessos (só para admin): uma linha por sessão do navegador em que alguém abriu a
 *  Rede logado, e as visitas à página pública /sobre (sem pessoa). */
export default function AcessosPage() {
  const { user } = useAuth()
  const [itens, setItens] = useState<Acesso[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState<'' | 'rede' | 'sobre'>('rede')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    const t = window.setTimeout(() => {
      getAcessos({ q: q.trim() || undefined, tipo: tipo || undefined, limite: POR_PAGINA, offset: 0 })
        .then((d) => { if (vivo) { setItens(d.itens); setTotal(d.total) } })
        .catch(() => {})
        .finally(() => vivo && setCarregando(false))
    }, 250)
    return () => { vivo = false; window.clearTimeout(t) }
  }, [q, tipo])

  if (user?.role !== 'admin') return <Navigate to="/admin/usuarios" replace />

  const mais = () => {
    getAcessos({ q: q.trim() || undefined, tipo: tipo || undefined, limite: POR_PAGINA, offset: itens.length })
      .then((d) => { setItens((a) => [...a, ...d.itens]); setTotal(d.total) })
      .catch(() => {})
  }

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Acessos</h1>
      </div>
      <p style={{ margin: '0 0 var(--sp-4)', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted, #6b7280)', maxWidth: '72ch' }}>
        Cada linha é uma sessão do navegador em que a pessoa abriu a Rede logada (no máximo uma por sessão). Registro desde 19/11/2026.
        Visível só para a administração.
      </p>

      <div className={styles.toolbar} style={{ marginBottom: 'var(--sp-3)' }}>
        <input className={styles.searchInput} type="search" placeholder="Buscar pessoa" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Buscar pessoa" />
        <select className={styles.filterSelect} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} aria-label="Tipo de acesso">
          <option value="rede">Rede (com login)</option>
          <option value="sobre">Página pública</option>
          <option value="">Todos</option>
        </select>
        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted, #6b7280)' }}>{total} {total === 1 ? 'acesso' : 'acessos'}</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Pessoa</th>
              <th>Órgão</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((a) => (
              <tr key={a.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{a.quando ? QUANDO.format(new Date(a.quando)) : '—'}</td>
                <td>
                  {a.analista_id
                    ? <Link to={`/analistas/${a.analista_id}`}>{a.nome}</Link>
                    : a.excluida ? <em>Conta excluída</em> : <em>Visitante da página pública</em>}
                </td>
                <td>{a.orgao ?? '—'}</td>
              </tr>
            ))}
            {!itens.length && (
              <tr><td colSpan={3} className={styles.empty}>{carregando ? 'Carregando…' : 'Nenhum acesso encontrado.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {itens.length < total && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <Button size="sm" variant="outline" onClick={mais}>Carregar mais</Button>
        </div>
      )}
    </div>
  )
}
