import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Comparado, Grupo } from '../api/admin'
import { numero, pct } from './formato'
import s from './stats.module.css'

/** Número de destaque. Com `comparado`, mostra a diferença para o período anterior. */
export function Kpi({ rotulo, valor, detalhe, comparado, anterior, para }: {
  rotulo: string
  valor: ReactNode
  detalhe?: ReactNode
  comparado?: Comparado
  /** texto do período de comparação, ex.: "30 dias anteriores" */
  anterior?: string
  para?: string
}) {
  const conteudo = (
    <>
      <p className={s.kpiRotulo}>{rotulo}</p>
      <p className={s.kpiValor}>{valor}</p>
      {comparado && comparado.anterior !== null && <Delta c={comparado} anterior={anterior} />}
      {detalhe && <p className={s.kpiDetalhe}>{detalhe}</p>}
    </>
  )
  return para ? (
    <Link to={para} className={`${s.kpi} ${s.kpiLink}`}>{conteudo}</Link>
  ) : (
    <div className={s.kpi}>{conteudo}</div>
  )
}

function Delta({ c, anterior }: { c: Comparado; anterior?: string }) {
  const dif = c.atual - (c.anterior ?? 0)
  const classe = dif > 0 ? s.deltaSobe : dif < 0 ? s.deltaDesce : s.deltaIgual
  const seta = dif > 0 ? '▲' : dif < 0 ? '▼' : '='
  return (
    <p className={`${s.delta} ${classe}`}>
      <span aria-hidden>{seta}</span> {dif > 0 ? '+' : ''}{numero(dif)}
      <span className={s.deltaContexto}> em relação aos {anterior} ({numero(c.anterior ?? 0)})</span>
    </p>
  )
}

export function Cartao({ titulo, subtitulo, children, largo, acao }: {
  titulo: string
  subtitulo?: ReactNode
  children: ReactNode
  largo?: boolean
  acao?: ReactNode
}) {
  return (
    <section className={`${s.cartao} ${largo ? s.cartaoLargo : ''}`}>
      <header className={s.cartaoTopo}>
        <div>
          <h2 className={s.cartaoTitulo}>{titulo}</h2>
          {subtitulo && <p className={s.cartaoSubtitulo}>{subtitulo}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  )
}

export const Vazio = ({ children = 'Sem dados ainda.' }: { children?: ReactNode }) => (
  <p className={s.vazio}>{children}</p>
)

/** Distribuição em barras horizontais. Cada grupo com filtro abre a lista de usuários com essas pessoas. */
export function Barras({ grupos, base, titulo }: { grupos: Grupo[]; base: number; titulo: string }) {
  if (grupos.length === 0) return <Vazio />
  const maior = Math.max(...grupos.map((g) => g.total))
  return (
    <ul className={s.barras}>
      {grupos.map((g) => {
        const conteudo = (
          <>
            <span className={s.barraRotulo} title={g.rotulo}>{g.rotulo}</span>
            <span className={s.barraTrilho} aria-hidden>
              <span className={s.barraFill} style={{ width: `${(g.total / maior) * 100}%` }} />
            </span>
            <span className={s.barraValor}>
              {numero(g.total)} <small>{pct(g.total, base)}%</small>
            </span>
          </>
        )
        return (
          <li key={g.rotulo}>
            {g.filtro ? (
              <Link
                className={`${s.barra} ${s.barraLink}`}
                to={`/admin/usuarios?${g.filtro}&titulo=${encodeURIComponent(`${titulo}: ${g.rotulo}`)}`}
                title={`Ver as ${g.total} pessoas na lista de usuários`}
              >
                {conteudo}
              </Link>
            ) : (
              <div className={s.barra}>{conteudo}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function NotaOutros({ minimo }: { minimo: number }) {
  return (
    <p className={s.nota}>
      Grupos com menos de {minimo} pessoas aparecem juntos em “Outros”, para que nenhum número identifique alguém.
      Clique numa barra para ver as pessoas na lista de usuários.
    </p>
  )
}

/** Etapas em sequência: cada uma conta quem passou também por todas as anteriores. */
export function Funil({ etapas }: { etapas: { chave: string; rotulo: string; total: number }[] }) {
  const topo = etapas[0]?.total ?? 0
  if (!topo) return <Vazio />
  return (
    <ol className={s.funil}>
      {etapas.map((e, i) => {
        const perda = i > 0 ? etapas[i - 1].total - e.total : 0
        return (
          <li key={e.chave} className={s.funilEtapa}>
            <div className={s.funilLinha}>
              <span className={s.funilRotulo}>{e.rotulo}</span>
              <span className={s.funilValor}>
                {numero(e.total)} <small>{pct(e.total, topo)}%</small>
              </span>
            </div>
            <span className={s.barraTrilho} aria-hidden>
              <span className={s.barraFill} style={{ width: `${(e.total / topo) * 100}%` }} />
            </span>
            {perda > 0 && <p className={s.funilPerda}>{numero(perda)} {perda === 1 ? 'parou' : 'pararam'} antes desta etapa</p>}
          </li>
        )
      })}
    </ol>
  )
}

/** Barras de completude: quantos têm cada item, com atalho para quem não tem. */
export function Completude({ itens, base }: { itens: { chave: string; rotulo: string; total: number }[]; base: number }) {
  if (!base) return <Vazio />
  return (
    <ul className={s.barras}>
      {[...itens].sort((a, b) => b.total - a.total).map((c) => {
        const faltam = base - c.total
        return (
          <li key={c.chave} className={`${s.barra} ${s.barraCompletude}`}>
            <span className={s.barraRotulo}>{c.rotulo}</span>
            <span className={s.barraTrilho} aria-hidden>
              <span className={s.barraFill} style={{ width: `${pct(c.total, base)}%` }} />
            </span>
            <span className={s.barraValor}>{pct(c.total, base)}%</span>
            {faltam > 0 ? (
              <Link
                className={s.barraAtalho}
                to={`/admin/usuarios?sem=${c.chave}&titulo=${encodeURIComponent(`Perfis sem: ${c.rotulo}`)}`}
              >
                ver {numero(faltam)} sem
              </Link>
            ) : (
              <span className={s.barraAtalho}>todos têm</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
