import { api } from './client'
import type { MinhaRedePagina, NovidadesRede, OrgaoResumo, ResumoPublico, Unidade } from './types'

export const unidadesApi = {
  /** Órgãos da estrutura oficial com quantas pessoas da Rede estão em cada um */
  orgaos: () => api.get<OrgaoResumo[]>('/unidades').then((r) => r.data),
  ver: (id: number | string) => api.get<Unidade>(`/unidades/${id}`).then((r) => r.data),
}

export const redeApi = {
  novidades: () => api.get<NovidadesRede>('/rede/novidades').then((r) => r.data),
  /** Página "Minha rede": grupos por proximidade e recém-chegados */
  pagina: () => api.get<MinhaRedePagina>('/rede/pagina').then((r) => r.data),
  marcarVistas: () => api.post('/rede/novidades/visto'),
  /** Números agregados para a página pública (sem login) */
  resumo: () => api.get<ResumoPublico>('/publico/resumo').then((r) => r.data),
}
