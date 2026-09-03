import { api } from './client'
import type { AnalistaOut, AnalistaPublico, AnalistaUpdate, Formacao, Tema, NivelFormacao } from './types'

export interface FormacaoInput {
  nivel: NivelFormacao
  curso: string
  instituicao: string
}

export interface TemaInput {
  tema: string
  em_exercicio_atual: boolean
}

export const perfilApi = {
  getMe: () => api.get<AnalistaOut>('/perfil/me').then((r) => r.data),
  updateMe: (data: AnalistaUpdate) => api.put<AnalistaOut>('/perfil/me', data).then((r) => r.data),
  addFormacao: (data: FormacaoInput) =>
    api.post<Formacao>('/perfil/formacao', data).then((r) => r.data),
  deleteFormacao: (id: number) => api.delete(`/perfil/formacao/${id}`),
  addTema: (data: TemaInput) => api.post<Tema>('/perfil/tema', data).then((r) => r.data),
  deleteTema: (id: number) => api.delete(`/perfil/tema/${id}`),
  getTemassugestoes: (q: string) =>
    api.get<string[]>('/perfil/temas/sugestoes', { params: { q } }).then((r) => r.data),
  uploadFoto: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<AnalistaOut>('/perfil/foto', form).then((r) => r.data)
  },
  getAnalista: (id: number | string) =>
    api.get<AnalistaPublico>(`/analistas/${id}`).then((r) => r.data),
  deleteMe: (senha: string) => api.delete('/perfil/me', { data: { senha } }),
}
