import { api } from './client'
import type { MinhaRede, MinhaRedePagina, NovidadesRede, OrgaoResumo, ResumoPublico, Unidade } from './types'

export const unidadesApi = {
  /** Órgãos da estrutura oficial com quantas pessoas da Rede estão em cada um */
  orgaos: () => api.get<OrgaoResumo[]>('/unidades').then((r) => r.data),
  ver: (id: number | string) => api.get<Unidade>(`/unidades/${id}`).then((r) => r.data),
}

export const redeApi = {
  novidades: () => api.get<NovidadesRede>('/rede/novidades').then((r) => r.data),
  /** Página "Minha rede": anéis, lugares vazios, seus temas e recém-chegados */
  pagina: () => api.get<MinhaRedePagina>('/rede/pagina').then((r) => r.data),
  /** Você no centro, as pessoas mais próximas ao redor e as ligações reais entre elas */
  minha: (limite: number) => api.get<MinhaRede>('/rede/minha', { params: { limite } }).then((r) => r.data),
  marcarVistas: () => api.post('/rede/novidades/visto'),
  /** Números agregados para a página pública (sem login) */
  resumo: () => api.get<ResumoPublico>('/publico/resumo').then((r) => r.data),
}
