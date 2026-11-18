import { useEffect, useState } from 'react'
import { lotacoesApi, type FiltroLotacao } from '@shared/api/lotacoes'
import type { Lotacao, NivelLotacao } from '@shared/api/types'
import styles from './perfil.module.css'

export interface NivelValor {
  nome: string
  sigla: string
  /** true quando a pessoa escolheu "+ Adicionar" e digitou um nome novo */
  novo: boolean
}
export type LotacaoValor = Record<NivelLotacao, NivelValor>

const NOVO = '__novo__'

export const NIVEIS_LOTACAO: Array<{
  id: NivelLotacao; rotulo: string; adicionar: string; nomeNovo: string; sigla: string | null; obrigatorio?: boolean
}> = [
  { id: 'ministerio', rotulo: 'Ministério', adicionar: 'Adicionar novo ministério', nomeNovo: 'Nome completo do novo ministério', sigla: 'Sigla do ministério', obrigatorio: true },
  { id: 'secretaria', rotulo: 'Secretaria', adicionar: 'Adicionar nova secretaria', nomeNovo: 'Nome da nova secretaria', sigla: 'Sigla da secretaria' },
  { id: 'departamento', rotulo: 'Departamento', adicionar: 'Adicionar novo departamento', nomeNovo: 'Nome do novo departamento', sigla: 'Sigla do departamento' },
  { id: 'coordenacao_geral', rotulo: 'Coordenação-Geral', adicionar: 'Adicionar nova coordenação-geral', nomeNovo: 'Nome da nova coordenação-geral', sigla: null },
  { id: 'coordenacao', rotulo: 'Coordenação', adicionar: 'Adicionar nova coordenação', nomeNovo: 'Nome da nova coordenação', sigla: null },
]

export const vazio = (): NivelValor => ({ nome: '', sigla: '', novo: false })

interface Props {
  valor: LotacaoValor
  onChange: (v: LotacaoValor) => void
  erros: Partial<Record<string, string>>
}

/**
 * Órgão de exercício: um select por nível, cada um filtrado pelo nível acima (GET /lotacoes).
 * "+ Adicionar" abre um campo para um nome novo. Sem o endpoint, cada nível vira texto livre.
 */
export default function CamposLotacao({ valor, onChange, erros }: Props) {
  const [opcoes, setOpcoes] = useState<Partial<Record<NivelLotacao, Lotacao[]>>>({})
  const [semLista, setSemLista] = useState(false)

  // recarrega as opções de cada nível quando muda o caminho acima dele
  const chave = NIVEIS_LOTACAO.map((n) => `${valor[n.id].nome}|${valor[n.id].novo}`).join('/')
  useEffect(() => {
    let vivo = true
    NIVEIS_LOTACAO.forEach((n, i) => {
      const acima = NIVEIS_LOTACAO.slice(0, i)
      // acima de um nível novo ou vazio não há o que listar
      if (acima.some((x) => !valor[x.id].nome || valor[x.id].novo)) {
        setOpcoes((o) => ({ ...o, [n.id]: [] }))
        return
      }
      const filtro: FiltroLotacao = Object.fromEntries(acima.map((x) => [x.id, valor[x.id].nome]))
      lotacoesApi.listar(n.id, filtro).then((l) => {
        if (!vivo) return
        if (i === 0 && !l.length) setSemLista(true)
        setOpcoes((o) => ({ ...o, [n.id]: l }))
      }).catch(() => {})
    })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  const mudar = (i: number, nivel: NivelValor) => {
    const novo = { ...valor, [NIVEIS_LOTACAO[i].id]: nivel }
    // trocar um nível limpa os de baixo
    NIVEIS_LOTACAO.slice(i + 1).forEach((n) => { novo[n.id] = vazio() })
    onChange(novo)
  }

  return (
    <div className={styles.grade2}>
      {NIVEIS_LOTACAO.map((n, i) => {
        const atual = valor[n.id]
        const lista = opcoes[n.id] ?? []
        const paiVazio = i > 0 && !valor[NIVEIS_LOTACAO[i - 1].id].nome
        // sem lista conhecida (endpoint ausente ou nível novo acima), o campo é texto livre
        const livre = semLista || (i > 0 && NIVEIS_LOTACAO.slice(0, i).some((x) => valor[x.id].novo))
        const naLista = lista.some((l) => l.nome === atual.nome)
        const valorSelect = atual.novo ? NOVO : atual.nome
        const erroNome = erros[n.id]
        const erroSigla = erros[`${n.id}_sigla`]
        const campoNome = (
          <div className={styles.campo}>
            <label htmlFor={`lot-${n.id}`}>{n.rotulo}{n.obrigatorio && <span className={styles.obrig} aria-hidden> *</span>}</label>
            {livre ? (
              <input id={`lot-${n.id}`} value={atual.nome} disabled={paiVazio}
                aria-invalid={!!erroNome} aria-describedby={erroNome ? `erro-${n.id}` : undefined}
                placeholder={paiVazio ? '—' : undefined}
                onChange={(e) => mudar(i, { ...atual, nome: e.target.value, novo: true })} />
            ) : (
              <>
                <select id={`lot-${n.id}`} value={valorSelect} disabled={paiVazio}
                  aria-invalid={!!erroNome && !atual.novo} aria-describedby={erroNome ? `erro-${n.id}` : undefined}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === NOVO) mudar(i, { nome: '', sigla: '', novo: true })
                    else mudar(i, { nome: v, sigla: lista.find((l) => l.nome === v)?.sigla ?? '', novo: false })
                  }}>
                  {paiVazio ? <option value="">—</option> : <option value="">{i === 0 ? 'Selecione…' : 'Não se aplica'}</option>}
                  {lista.map((l) => <option key={l.nome} value={l.nome}>{l.nome}</option>)}
                  {atual.nome && !atual.novo && !naLista && <option value={atual.nome}>{atual.nome}</option>}
                  {!paiVazio && <option value={NOVO}>+ {n.adicionar}</option>}
                </select>
                {atual.novo && (
                  <input className={styles.campoNovo} value={atual.nome} autoFocus
                    placeholder={n.nomeNovo} aria-label={n.nomeNovo}
                    aria-invalid={!!erroNome} aria-describedby={erroNome ? `erro-${n.id}` : undefined}
                    onChange={(e) => onChange({ ...valor, [n.id]: { ...atual, nome: e.target.value } })} />
                )}
              </>
            )}
            {erroNome && <p className={styles.erro} id={`erro-${n.id}`}>{erroNome}</p>}
          </div>
        )
        if (!n.sigla) return <div key={n.id}>{campoNome}</div>
        const siglaConhecida = !atual.novo && !livre && naLista && !!atual.sigla
        return (
          <div key={n.id} className={styles.parLotacao}>
            {campoNome}
            <div className={styles.campo}>
              <label htmlFor={`lot-${n.id}-sigla`}>{n.sigla}</label>
              <input id={`lot-${n.id}-sigla`} value={atual.sigla} maxLength={30} readOnly={siglaConhecida}
                disabled={paiVazio} tabIndex={siglaConhecida ? -1 : 0} placeholder={atual.novo ? 'ex.: SNAS' : undefined}
                aria-invalid={!!erroSigla} aria-describedby={erroSigla ? `erro-${n.id}-sigla` : undefined}
                onChange={(e) => onChange({ ...valor, [n.id]: { ...atual, sigla: e.target.value } })} />
              {erroSigla && <p className={styles.erro} id={`erro-${n.id}-sigla`}>{erroSigla}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
