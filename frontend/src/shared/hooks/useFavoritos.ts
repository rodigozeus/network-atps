import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { favoritosApi } from '@shared/api/favoritos'

// Lista de favoritos compartilhada entre cards, linhas e perfil: carrega uma vez por sessão
let ids = new Set<number>()
let carregado = false
let carregando: Promise<void> | null = null
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((fn) => fn())

function carregar() {
  if (carregado || carregando) return carregando
  carregando = favoritosApi
    .listarIds()
    .then((lista) => {
      ids = new Set(lista)
      carregado = true
      avisar()
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
  ids = new Set()
  carregado = false
  avisar()
}

export function useFavoritos() {
  const snapshot = useSyncExternalStore(
    (fn) => {
      ouvintes.add(fn)
      return () => ouvintes.delete(fn)
    },
    () => ids,
  )

  useEffect(() => {
    void carregar()
  }, [])

  const alternar = useCallback(async (analistaId: number) => {
    const favorito = !ids.has(analistaId)
    // otimista: muda na hora e desfaz se a API falhar
    ids = new Set(ids)
    if (favorito) ids.add(analistaId)
    else ids.delete(analistaId)
    avisar()
    try {
      await favoritosApi.marcar(analistaId, favorito)
    } catch (err) {
      ids = new Set(ids)
      if (favorito) ids.delete(analistaId)
      else ids.add(analistaId)
      avisar()
      throw err
    }
    return favorito
  }, [])

  return { favoritos: snapshot, ehFavorito: (id: number) => snapshot.has(id), alternar }
}
