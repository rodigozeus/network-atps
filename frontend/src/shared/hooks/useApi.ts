import { useState, useCallback } from 'react'
import axios from 'axios'
import type { ApiError } from '@shared/api/types'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

type ApiCall<T> = (...args: unknown[]) => Promise<T>

export function useApi<T>(apiFn: ApiCall<T>) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(
    async (...args: unknown[]) => {
      setState({ data: null, loading: true, error: null })
      try {
        const data = await apiFn(...args)
        setState({ data, loading: false, error: null })
        return data
      } catch (err) {
        let message = 'Erro inesperado. Tente novamente.'
        if (axios.isAxiosError(err)) {
          const apiErr = err.response?.data as ApiError | undefined
          if (typeof apiErr?.detail === 'string') {
            message = apiErr.detail
          } else if (Array.isArray(apiErr?.detail)) {
            message = apiErr.detail.map((d) => d.msg).join(', ')
          }
        }
        setState({ data: null, loading: false, error: message })
        throw err
      }
    },
    [apiFn],
  )

  return { ...state, execute }
}
