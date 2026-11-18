import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { favoritosApi } from '@shared/api/favoritos'
import type { EventoPerfil } from '@shared/api/types'

// Favoritos e suas novidades, compartilhados entre cards, linhas e perfil: carregam uma vez por sessão
interface Estado {
  ids: Set<number>
  novidades: Map<number, EventoPerfil[]>
}
let estado: Estado = { ids: new Set(), novidades: new Map() }
let carregado = false
let carregando: Promise<void> | null = null
const ouvintes = new Set<() => void>()
const mudar = (novo: Partial<Estado>) => {
  estado = { ...estado, ...novo }
  ouvintes.forEach((fn) => fn())
}

function carregar() {
  if (carregado || carregando) return carregando
  carregando = Promise.all([favoritosApi.listarIds(), favoritosApi.listarNovidades().catch(() => [])])
    .then(([lista, novidades]) => {
      carregado = true
      mudar({
        ids: new Set(lista),
        novidades: new Map(novidades.map((n) => [n.analista_id, n.eventos])),
      })
    })
    .catch(() => {
      // sem favoritos nesta sessão; tenta de novo na próxima montagem
    })
    .finally(() => {
      carregando = null
    })
  return carregando
}

/** Esquece os favoritos carregados (ao sair da conta) */
export function limparFavoritos() {
  carregado = false
  mudar({ ids: new Set(), novidades: new Map() })
}

export function useFavoritos() {
  const snapshot = useSyncExternalStore(
    (fn) => {
      ouvintes.add(fn)
      return () => ouvintes.delete(fn)
    },
    () => estado,
  )

  useEffect(() => {
    void carregar()
  }, [])

  const alternar = useCallback(async (analistaId: number) => {
    const antes = estado
    const favorito = !antes.ids.has(analistaId)
    // otimista: muda na hora e desfaz se a API falhar
    const ids = new Set(antes.ids)
    const novidades = new Map(antes.novidades)
    if (favorito) ids.add(analistaId)
    else {
      ids.delete(analistaId)
      novidades.delete(analistaId)
    }
    mudar({ ids, novidades })
    try {
      await favoritosApi.marcar(analistaId, favorito)
    } catch (err) {
      mudar({ ids: antes.ids, novidades: antes.novidades })
      throw err
    }
    return favorito
  }, [])

  /** Abriu o perfil do favorito: some a marca de novidade */
  const marcarVisto = useCallback((analistaId: number) => {
    if (!estado.novidades.has(analistaId)) return
    const novidades = new Map(estado.novidades)
    novidades.delete(analistaId)
    mudar({ novidades })
    void favoritosApi.marcarVisto(analistaId).catch(() => {})
  }, [])

  return {
    favoritos: snapshot.ids,
    novidades: snapshot.novidades,
    ehFavorito: (id: number) => snapshot.ids.has(id),
    novidadesDe: (id: number) => snapshot.novidades.get(id),
    alternar,
    marcarVisto,
  }
}
