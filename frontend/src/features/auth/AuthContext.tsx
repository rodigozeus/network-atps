import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from '@shared/api/client'
import type { AnalistaCreate, AnalistaOut, RegistroOut } from '@shared/api/types'

interface AuthState {
  user: AnalistaOut | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, senha: string) => Promise<void>
  register: (data: AnalistaCreate) => Promise<RegistroOut>
  logout: () => Promise<void>
  /** Substitui o usuário em memória (ex.: após a atualização cadastral) */
  updateUser: (user: AnalistaOut) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AnalistaOut | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session from the HttpOnly cookie on mount (sem redirecionar se não houver sessão)
  useEffect(() => {
    api
      .get<AnalistaOut>('/perfil/me', { _skipAuthRedirect: true })
      .then(({ data }) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, senha: string) => {
    // /auth/login uses OAuth2PasswordRequestForm → form-urlencoded
    const form = new URLSearchParams({ username: email, password: senha })
    await api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const { data: me } = await api.get<AnalistaOut>('/perfil/me')
    setUser(me)
  }, [])

  const register = useCallback(async (data: AnalistaCreate): Promise<RegistroOut> => {
    const { data: resultado } = await api.post<RegistroOut>('/auth/register', data)
    return resultado
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, register, logout, updateUser: setUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>')
  return ctx
}
