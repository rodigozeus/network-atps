import { api } from './client'
import { perfilApi } from './perfil'
import { semEndpoint } from './semEndpoint'
import type { TemaCatalogo } from './types'

export const temasApi = {
  /**
   * Todos os temas de atuação citados na rede, para o filtro da busca.
   * Sem GET /temas no back-end, usa as sugestões existentes (só as 8 mais citadas).
   */
  listar: async (): Promise<TemaCatalogo[]> => {
    try {
      const { data } = await api.get<TemaCatalogo[]>('/temas')
      return data
    } catch (err) {
      if (!semEndpoint(err)) throw err
      const sugestoes = await perfilApi.getTemassugestoes('')
      return sugestoes.map((s) => ({ tema: s.nome, tipo: s.tipo, total: s.total }))
    }
  },
}
