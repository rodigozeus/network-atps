import { api } from './client'
import { semEndpoint } from './semEndpoint'
import type { NovidadesFavorito } from './types'

const CHAVE_LOCAL = 'favoritos'

// Enquanto o back-end não tiver /favoritos, a lista fica só neste navegador.
let modoLocal = false
const lerLocal = (): number[] => {
  try {
    return (JSON.parse(localStorage.getItem(CHAVE_LOCAL) ?? '[]') as unknown[]).filter(
      (x): x is number => typeof x === 'number',
    )
  } catch {
    return []
  }
}
const salvarLocal = (ids: number[]) => {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(ids))
  } catch {
    // armazenamento bloqueado: o favorito vale só até recarregar a página
  }
}

export const favoritosApi = {
  /** Ids dos analistas que quem está logado favoritou */
  listarIds: async (): Promise<number[]> => {
    if (!modoLocal) {
      try {
        const { data } = await api.get<number[]>('/favoritos/ids')
        return data
      } catch (err) {
        if (!semEndpoint(err)) throw err
        modoLocal = true
      }
    }
    return lerLocal()
  },

  marcar: async (analistaId: number, favorito: boolean): Promise<void> => {
    if (!modoLocal) {
      try {
        if (favorito) await api.put(`/favoritos/${analistaId}`)
        else await api.delete(`/favoritos/${analistaId}`)
        return
      } catch (err) {
        if (!semEndpoint(err)) throw err
        modoLocal = true
      }
    }
    const ids = lerLocal().filter((id) => id !== analistaId)
    salvarLocal(favorito ? [...ids, analistaId] : ids)
  },

  /** Favoritos com mudanças desde a última visita (vazio sem o endpoint) */
  listarNovidades: async (): Promise<NovidadesFavorito[]> => {
    if (modoLocal) return []
    try {
      const { data } = await api.get<NovidadesFavorito[]>('/favoritos/novidades')
      return data
    } catch (err) {
      if (semEndpoint(err)) return []
      throw err
    }
  },

  /** Abriu o perfil: as novidades até agora deixam de ser novidade */
  marcarVisto: async (analistaId: number): Promise<void> => {
    if (modoLocal) return
    try {
      await api.post(`/favoritos/${analistaId}/visto`)
    } catch (err) {
      if (!semEndpoint(err)) throw err
    }
  },

  /** true enquanto os favoritos estão só no navegador (back-end sem o endpoint) */
  emModoLocal: () => modoLocal,
}
