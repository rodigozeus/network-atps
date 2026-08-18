import { api } from './client'
import type { BuscaParams, BuscaResponse } from './types'

export const buscaApi = {
  buscar: (params: BuscaParams) =>
    api.get<BuscaResponse>('/busca', { params }).then((r) => r.data),
}
