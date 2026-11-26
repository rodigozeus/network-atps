import { useEffect, useLayoutEffect, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { buscaApi } from '@shared/api/busca'
import type { FiltroUnidades as Filtro } from '@shared/api/types'
import styles from './busca.module.css'

/** Filtro de unidade em seletores encadeados: órgão; escolhido o órgão, surge o das unidades
 * dele; e assim por diante até o nível mais fundo. Só aparecem unidades com pessoas, em ordem
 * alfabética. A busca filtra pela unidade escolhida mais funda (e tudo abaixo dela). */
export default function FiltroUnidades({ unidade, onChange, onMudouNiveis }: {
  unidade: number | undefined
  onChange: (unidade: number | undefined) => void
  /** avisa quando o número de seletores muda (a barra de filtros mede se ainda cabe) */
  onMudouNiveis?: () => void
}) {
  const [filtro, setFiltro] = useState<Filtro | null>(null)

  useEffect(() => {
    let vivo = true
    buscaApi.filtroUnidades(unidade).then((f) => vivo && setFiltro(f)).catch(() => {})
    return () => { vivo = false }
  }, [unidade])

  const niveis = filtro?.niveis ?? [{ pai: null, escolhida: null, opcoes: [] }]
  useLayoutEffect(() => { onMudouNiveis?.() }, [niveis.length, onMudouNiveis])

  return (
    <>
      {niveis.map((n, k) => {
        const escolhida = n.escolhida ?? ''
        const rotuloPai = n.pai ? (n.pai.sigla ?? n.pai.nome) : null
        return (
          <label key={n.pai?.id ?? 'orgaos'} className={styles.select}>
            <select
              value={escolhida}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : n.pai?.id)}
              aria-label={k === 0 ? 'Filtrar por órgão' : `Filtrar por unidade dentro de ${rotuloPai}`}
              className={n.escolhida ? styles.ativo : ''}
            >
              <option value="">{k === 0 ? 'Todos os órgãos' : `${rotuloPai}: todas as unidades`}</option>
              {n.opcoes.map((o) => (
                // fechado, o seletor mostra só a sigla (nome inteiro não cabe); aberto, o nome completo
                <option key={o.id} value={o.id} title={o.nome}>
                  {o.id === n.escolhida && o.sigla ? o.sigla : `${o.nome}${o.sigla ? ` (${o.sigla})` : ''} · ${o.membros}`}
                </option>
              ))}
            </select>
            <IconChevronDown size={18} aria-hidden />
          </label>
        )
      })}
    </>
  )
}
