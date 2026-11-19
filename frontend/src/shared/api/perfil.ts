import { api } from './client'
import type {
  AnalistaOut, AnalistaPublico, AnalistaUpdate, Consentimento, DocumentoLegal, Formacao,
  NivelFormacao, Proximo, RegularizarIn, Tema, TemaSugestao, TipoTema,
} from './types'

export interface FormacaoInput {
  nivel: NivelFormacao
  curso: string
  instituicao: string
}

/** Um tema do catálogo (tema_id) ou um nome digitado. Nome que ainda não existe na Rede só vira
 *  tema novo com confirmar_novo; sem isso a API responde 409 com os temas parecidos. */
export interface TemaInput {
  tema_id?: number
  tema?: string
  tipo: TipoTema
  em_exercicio_atual: boolean
  confirmar_novo?: boolean
}

export const perfilApi = {
  getMe: () => api.get<AnalistaOut>('/perfil/me').then((r) => r.data),
  updateMe: (data: AnalistaUpdate) => api.put<AnalistaOut>('/perfil/me', data).then((r) => r.data),
  addFormacao: (data: FormacaoInput) =>
    api.post<Formacao>('/perfil/formacao', data).then((r) => r.data),
  deleteFormacao: (id: number) => api.delete(`/perfil/formacao/${id}`),
  addTema: (data: TemaInput) => api.post<Tema>('/perfil/tema', data).then((r) => r.data),
  deleteTema: (id: number) => api.delete(`/perfil/tema/${id}`),
  getTemassugestoes: (q: string, tipo?: TipoTema) =>
    api.get<TemaSugestao[]>('/perfil/temas/sugestoes', { params: { q, tipo } }).then((r) => r.data),
  uploadFoto: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<AnalistaOut>('/perfil/foto', form).then((r) => r.data)
  },
  getAnalista: (id: number | string) =>
    api.get<AnalistaPublico>(`/analistas/${id}`).then((r) => r.data),
  responderSugestao: (aceitar: boolean) =>
    api.post<AnalistaOut>('/perfil/sugestao', { aceitar }).then((r) => r.data),
  getProximos: (id: number | string) =>
    api.get<Proximo[]>(`/analistas/${id}/proximos`).then((r) => r.data),
  deleteMe: (senha: string) => api.delete('/perfil/me', { data: { senha } }),
  regularizar: (data: RegularizarIn) =>
    api.post<AnalistaOut>('/perfil/regularizar', data).then((r) => r.data),
  getPrivacidade: () => api.get<Consentimento[]>('/perfil/privacidade').then((r) => r.data),
  /** Remove a foto de perfil */
  deleteFoto: () => api.delete<AnalistaOut>('/perfil/foto').then((r) => r.data),
}

export const documentosApi = {
  getAtuais: () => api.get<DocumentoLegal[]>('/documentos').then((r) => r.data),
}
