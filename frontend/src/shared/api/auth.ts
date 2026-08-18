import { api } from './client'

export const authApi = {
  forgotPassword: (email: string) =>
    api.post<{ detail: string }>('/auth/esqueci-senha', { email }).then((r) => r.data),
  resetPassword: (token: string, senha: string) =>
    api.post<{ detail: string }>('/auth/redefinir-senha', { token, senha }).then((r) => r.data),
}
