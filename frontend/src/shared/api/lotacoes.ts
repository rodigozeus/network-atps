import { api } from './client'
import { semEndpoint } from './semEndpoint'
import type { Lotacao, NivelLotacao } from './types'

export type FiltroLotacao = Partial<Record<NivelLotacao, string>>

// Depois do primeiro 404, não tenta mais nesta sessão (o back-end ainda não tem o endpoint)
let indisponivel = false

export const lotacoesApi = {
  /**
   * Lotações já cadastradas num nível, filtradas pelos níveis acima.
   * Ex.: listar('secretaria', { ministerio: 'Ministério da Saúde' }).
   * Sem o endpoint no back-end devolve lista vazia: os campos viram texto livre.
   */
  listar: async (nivel: NivelLotacao, acima: FiltroLotacao = {}): Promise<Lotacao[]> => {
    if (indisponivel) return []
    try {
      const { data } = await api.get<Lotacao[]>('/lotacoes', { params: { nivel, ...acima } })
      return data
    } catch (err) {
      if (!semEndpoint(err)) throw err
      indisponivel = true
      return []
    }
  },
}
