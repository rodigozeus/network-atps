import { api } from './client'
import type { BuscaParams, BuscaResponse, BuscaUnidadesResponse } from './types'

export const buscaApi = {
  buscar: (params: BuscaParams) =>
    api.get<BuscaResponse>('/busca', { params }).then((r) => r.data),
  unidades: (q: string, ministerio?: string) =>
    api.get<BuscaUnidadesResponse>('/busca/unidades', { params: { q, ministerio: ministerio || undefined } }).then((r) => r.data),
}
