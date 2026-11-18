import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

// A sessão fica em cookies HttpOnly definidos pelo backend — o JavaScript não tem
// acesso aos tokens. withCredentials garante o envio dos cookies.
// Remove tokens deixados pela versão anterior, que guardava a sessão no localStorage.
try {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
} catch {
  // armazenamento indisponível — nada a limpar
}

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
})

declare module 'axios' {
  interface AxiosRequestConfig {
    _retry?: boolean
    /** Não redireciona para /login se a sessão não existir (ex.: checagem inicial). */
    _skipAuthRedirect?: boolean
  }
}

// On 401: try refresh once, then redirect to /login.
// Endpoints de /auth/ respondem 401 por credenciais inválidas — não entram aqui.
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) return Promise.reject(error)

    const original = error.config
    const isAuthEndpoint = original.url?.startsWith('/auth/')
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true
      try {
        await axios.post(`${BASE_URL}/auth/refresh`, null, { withCredentials: true })
        return api(original)
      } catch {
        // refresh failed — fall through
      }
      if (!original._skipAuthRedirect) {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)
