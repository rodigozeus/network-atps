import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Cobertura } from '../api/admin'
import { getCobertura } from '../api/admin'
import styles from '../admin.module.css'

const pct = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 100) : 0)
const mesAno = (ref: string | null) => (ref ? `${ref.slice(4)}/${ref.slice(0, 4)}` : '—')

/** Quantos ATPS de cada órgão já estão na Rede, comparado ao total do órgão (base do Portal). */
export default function CoberturaPage() {
  const [c, setC] = useState<Cobertura | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCobertura().then(setC).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className={styles.empty}>Carregando…</p>
  if (!c) return <p className={styles.empty}>Não foi possível carregar a cobertura.</p>

  const dias = c.cadastros_por_dia.map((d) => ({ dia: d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7), total: d.total }))

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Cobertura da Rede</h1>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Na Rede</p>
          <p className={styles.statValue}>{c.total_rede}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>ATPS ativos (Portal, {mesAno(c.referencia)})</p>
          <p className={styles.statValue}>{c.total_universo || '—'}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Cobertura</p>
          <p className={[styles.statValue, styles.statValueGreen].join(' ')}>
            {c.total_universo ? `${pct(c.total_rede, c.total_universo)}%` : '—'}
          </p>
        </div>
      </div>

      {dias.length > 0 && (
        <div className={styles.chartCardFull}>
          <p className={styles.chartTitle}>Cadastros por dia (últimos 30 dias)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dias}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
              <Tooltip formatter={(v) => [String(v), 'cadastros']} />
              <Bar dataKey="total" fill="#f15e23" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Órgão de exercício</th>
              <th style={{ textAlign: 'right' }}>Na Rede</th>
              <th style={{ textAlign: 'right' }}>ATPS no órgão</th>
              <th style={{ width: '30%' }}>Cobertura</th>
            </tr>
          </thead>
          <tbody>
            {c.orgaos.map((o) => {
              const p = pct(o.rede, o.universo)
              return (
                <tr key={o.orgao_id}>
                  <td title={o.nome}><strong>{o.sigla ?? o.nome}</strong>{o.sigla && <><br /><small>{o.nome}</small></>}</td>
                  <td style={{ textAlign: 'right' }}>{o.rede}</td>
                  <td style={{ textAlign: 'right' }}>{o.universo || '—'}</td>
                  <td>
                    {o.universo ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, borderRadius: 99, background: '#eef0f3' }}>
                          <div style={{ width: `${Math.min(p, 100)}%`, height: '100%', borderRadius: 99, background: '#f15e23' }} />
                        </div>
                        <span style={{ minWidth: 40, textAlign: 'right' }}>{p}%</span>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
            {(c.sem_orgao_universo > 0 || c.sem_orgao_rede > 0) && (
              <tr>
                <td><em>Fora da estrutura dos ministérios ou não identificado</em><br />
                  <small>Autarquias, fundações e perfis com órgão digitado fora da lista oficial</small></td>
                <td style={{ textAlign: 'right' }}>{c.sem_orgao_rede}</td>
                <td style={{ textAlign: 'right' }}>{c.sem_orgao_universo}</td>
                <td>—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.empty} style={{ textAlign: 'left' }}>
        O total de ATPS vem da cópia local do download em massa do Portal da Transparência (ATPS ativos, por órgão de
        exercício). Aposentados não entram nesse total.
      </p>
    </div>
  )
}
