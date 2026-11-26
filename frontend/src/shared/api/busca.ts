import { api } from './client'
import type { BuscaParams, BuscaResponse, BuscaUnidadesResponse, FiltroUnidades } from './types'

export const buscaApi = {
  buscar: (params: BuscaParams) =>
    api.get<BuscaResponse>('/busca', { params }).then((r) => r.data),
  unidades: (q: string, unidade?: number) =>
    api.get<BuscaUnidadesResponse>('/busca/unidades', { params: { q, unidade } }).then((r) => r.data),
  filtroUnidades: (unidade?: number) =>
    api.get<FiltroUnidades>('/busca/filtro-unidades', { params: { unidade } }).then((r) => r.data),
}
