import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { corToken, diaCurto, numero } from './formato'
import s from './stats.module.css'

/** Séries temporais do painel, com o mesmo eixo, grade e dica em todos os gráficos. */

export interface Serie {
  chave: string
  nome: string
  cor: string
}

const eixo = () => ({ fontSize: 11, fill: corToken('--grafico-eixo', '#898781') })

function base(altura: number) {
  return {
    altura,
    grade: <CartesianGrid stroke={corToken('--grafico-grade', '#e1e0d9')} strokeDasharray="0" vertical={false} />,
    y: <YAxis allowDecimals={false} tick={eixo()} width={36} axisLine={false} tickLine={false} />,
  }
}

function X({ chave, rotulo }: { chave: string; rotulo?: (v: string) => string }) {
  return (
    <XAxis
      dataKey={chave}
      tick={eixo()}
      tickFormatter={rotulo ?? diaCurto}
      minTickGap={24}
      axisLine={{ stroke: corToken('--grafico-eixo', '#898781') }}
      tickLine={false}
    />
  )
}

interface Extra {
  chave: string
  nome: string
}

interface DicaProps {
  active?: boolean
  label?: string | number
  payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }>
  rotulo?: (v: string) => string
  extras?: Extra[]
}

/** Dica ao passar o mouse: o dia, cada série com sua cor e, se houver, números extras do mesmo ponto. */
function Dica({ active, label, payload, rotulo, extras = [] }: DicaProps) {
  if (!active || !payload?.length) return null
  const ponto = payload[0].payload ?? {}
  return (
    <div className={s.dica}>
      <p className={s.dicaTitulo}>{(rotulo ?? diaCurto)(String(label))}</p>
      {[...payload].reverse().map((p) => (
        <p key={p.name} className={s.dicaLinha}>
          <span className={s.dicaCor} style={{ background: p.color }} aria-hidden />
          {p.name}: <strong>{numero(Number(p.value ?? 0))}</strong>
        </p>
      ))}
      {extras.map((e) => (
        <p key={e.chave} className={s.dicaLinha}>
          {e.nome}: <strong>{numero(Number(ponto[e.chave] ?? 0))}</strong>
        </p>
      ))}
    </div>
  )
}

/** Legenda na ordem das séries, com o texto na cor de texto (a cor fica só no ícone) */
const legenda = (icone: 'plainline' | 'square') => (
  <Legend
    iconType={icone}
    itemSorter={null}
    wrapperStyle={{ fontSize: 12 }}
    formatter={(v) => <span style={{ color: 'var(--color-text-secondary)' }}>{v}</span>}
  />
)

const dica = (rotulo?: (v: string) => string, extras?: Extra[]) => (
  <Tooltip
    content={<Dica rotulo={rotulo} extras={extras} />}
    cursor={{ fill: 'rgba(0,0,0,0.04)', stroke: corToken('--grafico-eixo', '#898781') }}
  />
)

export function Linhas<T extends object>({ dados, x, series, altura = 220, rotuloX }: {
  dados: T[]; x: string; series: Serie[]; altura?: number; rotuloX?: (v: string) => string
}) {
  const b = base(altura)
  return (
    <ResponsiveContainer width="100%" height={b.altura}>
      <LineChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        {b.grade}
        <X chave={x} rotulo={rotuloX} />
        {b.y}
        {dica(rotuloX)}
        {series.length > 1 && legenda('plainline')}
        {series.map((se) => (
          <Line key={se.chave} dataKey={se.chave} name={se.nome} stroke={se.cor} strokeWidth={2}
            dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} type="monotone" />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export type { Extra }

export function Area1<T extends object>({ dados, x, serie, altura = 220, rotuloX, extras }: {
  dados: T[]; x: string; serie: Serie; altura?: number; rotuloX?: (v: string) => string; extras?: Extra[]
}) {
  const b = base(altura)
  return (
    <ResponsiveContainer width="100%" height={b.altura}>
      <AreaChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        {b.grade}
        <X chave={x} rotulo={rotuloX} />
        {b.y}
        {dica(rotuloX, extras)}
        <Area dataKey={serie.chave} name={serie.nome} stroke={serie.cor} fill={serie.cor} fillOpacity={0.12}
          strokeWidth={2} type="monotone" activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Barras empilhadas (uma série = uma barra simples). `limite` desenha uma linha de referência. */
export function Pilhas<T extends object>({ dados, x, series, altura = 220, rotuloX, limite }: {
  dados: T[]; x: string; series: Serie[]; altura?: number; rotuloX?: (v: string) => string
  limite?: { valor: number; rotulo: string }
}) {
  const b = base(altura)
  return (
    <ResponsiveContainer width="100%" height={b.altura}>
      <BarChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="20%">
        {b.grade}
        <X chave={x} rotulo={rotuloX} />
        {b.y}
        {dica(rotuloX)}
        {series.length > 1 && legenda('square')}
        {series.map((se, i) => (
          <Bar key={se.chave} dataKey={se.chave} name={se.nome} stackId="a" fill={se.cor}
            stroke="#fff" strokeWidth={series.length > 1 ? 1 : 0}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={28} />
        ))}
        {limite && (
          <ReferenceLine y={limite.valor} stroke={corToken('--delta-desce', '#b42318')} strokeDasharray="4 4"
            label={{ value: limite.rotulo, position: 'insideTopRight', fontSize: 11, fill: corToken('--grafico-eixo', '#898781') }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
