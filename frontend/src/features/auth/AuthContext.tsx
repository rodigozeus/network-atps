import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from '@shared/api/client'
import type { AnalistaCreate, AnalistaOut, TokenOut } from '@shared/api/types'

interface AuthState {
  user: AnalistaOut | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, senha: string) => Promise<void>
  register: (data: AnalistaCreate) => Promise<AnalistaOut>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AnalistaOut | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session from persisted token on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setIsLoading(false)
      return
    }
    api
      .get<AnalistaOut>('/perfil/me')
      .then(({ data }) => setUser(data))
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, senha: string) => {
    // /auth/login uses OAuth2PasswordRequestForm → form-urlencoded
    const form = new URLSearchParams({ username: email, password: senha })
    const { data } = await api.post<TokenOut>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const { data: me } = await api.get<AnalistaOut>('/perfil/me')
    setUser(me)
  }, [])

  const register = useCallback(async (data: AnalistaCreate): Promise<AnalistaOut> => {
    const { data: user } = await api.post<AnalistaOut>('/auth/register', data)
    return user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}
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
