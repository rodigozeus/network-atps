import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AdminStats } from '../api/admin'
import { getStats } from '../api/admin'
import styles from '../admin.module.css'

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']

export default function StatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStats()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className={styles.empty}>Carregando…</p>
  if (!stats) return <p className={styles.empty}>Não foi possível carregar as estatísticas.</p>

  const ministerioData = stats.por_ministerio.map((d) => ({
    name: d.ministerio_sigla ?? 'Sem ministério',
    total: d.total,
  }))

  const formacaoData = stats.por_nivel_formacao.map((d) => ({
    name: d.nivel,
    value: d.total,
  }))

  const temaData = stats.por_tema.map((d) => ({
    name: d.tema,
    total: d.total,
  }))

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Estatísticas</h1>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Total de analistas</p>
          <p className={styles.statValue}>{stats.total_analistas}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Ativos</p>
          <p className={`${styles.statValue} ${styles.statValueGreen}`}>{stats.total_ativos}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Inativos</p>
          <p className={`${styles.statValue} ${styles.statValueRed}`}>{stats.total_inativos}</p>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCardFull}>
          <p className={styles.chartTitle}>Analistas por ministério (top 10)</p>
          {ministerioData.length === 0 ? (
            <p className={styles.empty}>Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ministerioData} margin={{ top: 4, right: 16, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>Nível de formação</p>
          {formacaoData.length === 0 ? (
            <p className={styles.empty}>Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={formacaoData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={80}
                >
                  {formacaoData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} analistas`]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>Temas mais frequentes (top 10)</p>
          {temaData.length === 0 ? (
            <p className={styles.empty}>Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={temaData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
