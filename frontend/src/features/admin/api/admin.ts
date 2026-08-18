import { api } from '@shared/api/client'
import type { Role, Turma } from '@shared/api/types'

export interface AnalistaAdminOut {
  id: number
  nome: string
  email_pessoal: string
  email_institucional: string | null
  telefone_institucional: string | null
  celular: string | null
  ministerio: string | null
  ministerio_sigla: string | null
  secretaria: string | null
  secretaria_sigla: string | null
  departamento: string | null
  departamento_sigla: string | null
  coordenacao_geral: string | null
  coordenacao: string | null
  cargo_fce: string | null
  portal_url: string | null
  turma: Turma | null
  foto_path: string | null
  role: Role
  ativo: boolean
  pendente_revisao: boolean
  criado_em: string
  atualizado_em: string
  formacoes: { id: number; nivel: string; curso: string; instituicao: string }[]
  temas: { id: number; tema: string; em_exercicio_atual: boolean }[]
}

export interface AnalistaAdminUpdate {
  nome?: string
  email_pessoal?: string
  email_institucional?: string
  telefone_institucional?: string
  celular?: string
  ministerio?: string
  ministerio_sigla?: string
  secretaria?: string
  secretaria_sigla?: string
  departamento?: string
  departamento_sigla?: string
  coordenacao_geral?: string
  coordenacao?: string
  cargo_fce?: string
  portal_url?: string
  turma?: Turma
  role?: Role
  ativo?: boolean
}

export interface PaginatedAdminUsers {
  items: AnalistaAdminOut[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface AdminStats {
  total_analistas: number
  total_ativos: number
  total_inativos: number
  por_ministerio: { ministerio_sigla: string | null; total: number }[]
  por_nivel_formacao: { nivel: string; total: number }[]
  por_tema: { tema: string; total: number }[]
}

export interface ListUsuariosParams {
  q?: string
  ativo?: boolean
  pendente_revisao?: boolean
  page?: number
  page_size?: number
}

export async function getUsuarios(params: ListUsuariosParams = {}): Promise<PaginatedAdminUsers> {
  const { data } = await api.get<PaginatedAdminUsers>('/admin/usuarios', { params })
  return data
}

export async function updateUsuario(id: number, body: AnalistaAdminUpdate): Promise<AnalistaAdminOut> {
  const { data } = await api.put<AnalistaAdminOut>(`/admin/usuarios/${id}`, body)
  return data
}

export async function desativarUsuario(id: number): Promise<void> {
  await api.delete(`/admin/usuarios/${id}`)
}

export async function excluirUsuario(id: number): Promise<void> {
  await api.delete(`/admin/usuarios/${id}/excluir`)
}

export async function reativarUsuario(id: number): Promise<AnalistaAdminOut> {
  const { data } = await api.post<AnalistaAdminOut>(`/admin/usuarios/${id}/reativar`)
  return data
}

export async function getStats(): Promise<AdminStats> {
  const { data } = await api.get<AdminStats>('/admin/stats')
  return data
}

export function downloadCSV(): void {
  const token = localStorage.getItem('access_token')
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api'
  const url = `${base}/admin/export`
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'analistas.csv')
  // Não é possível passar header no <a>, então fazemos via fetch + blob
  fetch(url, { headers: { Authorization: `Bearer ${token ?? ''}` } })
    .then((res) => res.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob)
      link.href = objectUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
    })
}
