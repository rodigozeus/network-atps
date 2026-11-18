import type { Formacao, Tema } from '@shared/api/types'
import { NIVEIS, ordenarFormacoes } from '@shared/utils/analista'
import styles from './busca.module.css'

// Mostra 2 chips quando cabem; o resto vai para o "+N" com balão
const quantosCabem = (textos: string[], limite: number) =>
  !textos.length ? 0 : textos[0].length + (textos[1] ?? '').length <= limite ? Math.min(2, textos.length) : 1

const textoFormacao = (f: Formacao) =>
  f.instituicao.length <= 12 ? `${NIVEIS[f.nivel]} (${f.instituicao})` : NIVEIS[f.nivel]

export function ChipsFormacao({ formacoes, max }: { formacoes: Formacao[]; max?: number }) {
  if (!formacoes.length) return <span className={styles.vazio}>Não informada</span>
  const lista = ordenarFormacoes(formacoes)
  const n = max ?? quantosCabem(lista.map(textoFormacao), 34)
  const resto = lista.slice(n)
  return (
    <>
      {lista.slice(0, n).map((f) => (
        <button key={f.id} type="button" className={[styles.chip, styles.tip, styles.inicio].join(' ')}>
          {textoFormacao(f)}
          <span className={styles.pop} role="tooltip">
            <b>{NIVEIS[f.nivel]} · {f.instituicao}</b>
            {f.curso}
          </span>
        </button>
      ))}
      {resto.length > 0 && (
        <button type="button" className={[styles.chip, styles.tip, styles.mais].join(' ')} aria-label={`Mais ${resto.length} formações`}>
          +{resto.length}
          <span className={styles.pop} role="tooltip">
            {resto.map((f) => (
              <span key={f.id}>
                <b>{NIVEIS[f.nivel]} · {f.instituicao}</b>
                {f.curso}
              </span>
            ))}
          </span>
        </button>
      )}
    </>
  )
}

/** Temas em exercício primeiro; os de experiência anterior ficam marcados no balão */
export function ChipsTemas({ temas, max }: { temas: Tema[]; max?: number }) {
  if (!temas.length) return <span className={styles.vazio}>Não informados</span>
  const lista = [...temas].sort((a, b) => Number(b.em_exercicio_atual) - Number(a.em_exercicio_atual))
  const n = max ?? quantosCabem(lista.map((t) => t.tema), 34)
  const resto = lista.slice(n)
  return (
    <>
      {lista.slice(0, n).map((t) => (
        <span key={t.id} className={[styles.chip, t.em_exercicio_atual ? '' : styles.anterior].join(' ')}
          title={t.em_exercicio_atual ? undefined : 'Experiência anterior'}>
          {t.tema}
        </span>
      ))}
      {resto.length > 0 && (
        <button type="button" className={[styles.chip, styles.tip, styles.mais].join(' ')} aria-label={`Mais ${resto.length} temas`}>
          +{resto.length}
          <span className={styles.pop} role="tooltip">
            {resto.map((t) => (
              <span key={t.id}>
                {t.tema}
                {!t.em_exercicio_atual && <em> · experiência anterior</em>}
              </span>
            ))}
          </span>
        </button>
      )}
    </>
  )
}
