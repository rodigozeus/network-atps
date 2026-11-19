import { Link } from 'react-router-dom'
import type { AnalistaPublico, AnelRede } from '@shared/api/types'
import { Avatar } from '@shared/components'
import { nomeCurto } from '@shared/utils/analista'
import styles from './rede.module.css'

export const MOTIVO_DO_ANEL: Record<string, string> = {
  coordenacao: 'Mesma coordenação',
  coordenacao_geral: 'Mesma coordenação-geral',
  departamento: 'Mesmo departamento',
  secretaria: 'Mesma secretaria',
  ministerio: 'Mesmo ministério',
  temas: 'Temas em comum',
  favoritos: 'Seu favorito',
}

const LADO = 640 // tamanho de referência do desenho (px); escala com a largura
const RAIO_CENTRO = 70
const MARGEM = 34
const FOTO = 48
const MAX_ANEIS = 4

const pct = (v: number) => `${(v / LADO) * 100}%`

/** Você no centro; cada anel é uma relação, do mais perto (dentro) ao mais longe (fora).
 *  Sem linhas: a distância ao centro já diz a proximidade. Passar o mouse mostra nome e motivo. */
export default function Orbitas({ eu, aneis, tema }: { eu: AnalistaPublico; aneis: AnelRede[]; tema: string | null }) {
  const visiveis = aneis.slice(0, MAX_ANEIS)
  const c = LADO / 2
  const passo = (c - MARGEM - RAIO_CENTRO) / visiveis.length

  return (
    <div className={styles.orbitas} role="group" aria-label="Sua rede em anéis de proximidade">
      <svg viewBox={`0 0 ${LADO} ${LADO}`} className={styles.orbitasSvg} aria-hidden>
        {visiveis.map((a, k) => (
          <circle key={a.chave} cx={c} cy={c} r={RAIO_CENTRO + passo * (k + 1)} />
        ))}
      </svg>

      <Link to={`/analistas/${eu.id}`} className={styles.centro} aria-label="Você. Ver seu perfil">
        <Avatar id={eu.id} nome={eu.nome} fotoPath={eu.foto_path} tamanho={84} />
        <span>Você</span>
      </Link>

      {visiveis.map((anel, k) => {
        const r = RAIO_CENTRO + passo * (k + 1)
        const cabe = Math.max(4, Math.floor((2 * Math.PI * r) / (FOTO + 14)) - 1) // 1 lugar fica para o rótulo
        const mostrar = anel.pessoas.slice(0, anel.total > cabe ? cabe - 1 : cabe)
        const sobra = anel.total - mostrar.length
        const n = mostrar.length + (sobra > 0 ? 1 : 0)
        // n + 1 posições iguais no anel: a do alto fica com o rótulo, as outras com as pessoas
        const angulo = (i: number) => -Math.PI / 2 + ((i + 1) * Math.PI * 2) / (n + 1)
        const posicao = (i: number) => ({ left: pct(c + Math.cos(angulo(i)) * r), top: pct(c + Math.sin(angulo(i)) * r) })
        return (
          <div key={anel.chave}>
            <span className={styles.anelRotulo} style={{ left: pct(c), top: pct(c - r) }}>
              {MOTIVO_DO_ANEL[anel.chave]}
            </span>
            {mostrar.map((p, i) => {
              const destaque = !tema || p.temas_comuns.includes(tema)
              const motivo = anel.chave === 'temas'
                ? `Em comum: ${p.temas_comuns.join(', ')}`
                : [MOTIVO_DO_ANEL[anel.chave], p.temas_comuns.length ? `Em comum: ${p.temas_comuns.join(', ')}` : ''].filter(Boolean).join(' · ')
              return (
                <Link key={p.analista.id} to={`/analistas/${p.analista.id}`}
                  className={[styles.pessoa, destaque ? '' : styles.apagado, tema && destaque ? styles.destacado : ''].join(' ')}
                  style={posicao(i)} aria-label={`${p.analista.nome}. ${motivo}`}>
                  <Avatar id={p.analista.id} nome={p.analista.nome} fotoPath={p.analista.foto_path} tamanho={FOTO} />
                  {p.recente && <span className={styles.novo} aria-hidden>novo</span>}
                  <span className={styles.dica} aria-hidden>
                    <b>{nomeCurto(p.analista.nome)}</b>
                    {p.analista.cargo_fce && <span>{p.analista.cargo_fce}</span>}
                    <small>{motivo}</small>
                  </span>
                </Link>
              )
            })}
            {sobra > 0 && (
              <a href={`#anel-${anel.chave}`} className={[styles.pessoa, styles.maisBolinha].join(' ')}
                style={posicao(mostrar.length)} aria-label={`Mais ${sobra} pessoas: ${MOTIVO_DO_ANEL[anel.chave]}`}>
                +{sobra}
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
