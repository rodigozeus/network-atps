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
  motivo_pendencia: string | null
  perfil_oculto: boolean
  cpf_verificado_em: string | null
  vinculo_manual: boolean
  vinculo_suspenso_em: string | null
  vinculo_exclusao_em: string | null
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
  /** Uma visita = a Rede aberta numa sessão do navegador */
  visitas: {
    hoje: number
    ultimos_7: number
    ultimos_30: number
    total: number
    pessoas_30: number
    publica_30: number
    por_dia: { dia: string; visitas: number; pessoas: number }[]
  }
}

export interface ListUsuariosParams {
  q?: string
  ativo?: boolean
  pendente_revisao?: boolean
  alerta_vinculo?: boolean
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

export async function confirmarVinculo(id: number): Promise<AnalistaAdminOut> {
  const { data } = await api.post<AnalistaAdminOut>(`/admin/usuarios/${id}/confirmar-vinculo`)
  return data
}

export async function getStats(): Promise<AdminStats> {
  const { data } = await api.get<AdminStats>('/admin/stats')
  return data
}

export function downloadCSV(): void {
  api.get<Blob>('/admin/export', { responseType: 'blob' }).then(({ data }) => {
    const objectUrl = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = objectUrl
    link.setAttribute('download', 'analistas.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  })
}

export interface ConflitoCadastro {
  id: number
  analista_id: number
  analista_nome: string
  analista_email: string
  nome_informado: string
  email_informado: string
  resolvido: boolean
  criado_em: string
}

export async function getConflitos(): Promise<ConflitoCadastro[]> {
  const { data } = await api.get<ConflitoCadastro[]>('/admin/conflitos')
  return data
}

export async function resolverConflito(id: number): Promise<void> {
  await api.post(`/admin/conflitos/${id}/resolver`)
}

export interface Cobertura {
  /** AAAAMM da cópia local da base do Portal (universo) */
  referencia: string | null
  total_universo: number
  total_rede: number
  orgaos: Array<{ orgao_id: number; nome: string; sigla: string | null; universo: number; rede: number }>
  sem_orgao_universo: number
  sem_orgao_rede: number
  cadastros_por_dia: Array<{ dia: string; total: number }>
}

export async function getCobertura(): Promise<Cobertura> {
  const { data } = await api.get<Cobertura>('/admin/cobertura')
  return data
}

// --- Curadoria de temas ---

export type TipoTema = 'area' | 'ferramenta'

export interface TemaAdmin {
  id: number
  nome: string
  tipo: TipoTema
  apelidos: string[]
  revisado: boolean
  reprovado: boolean
  total: number
  criado_em: string | null
  criado_por: string | null
}

export interface TemasAdmin {
  temas: TemaAdmin[]
  pares: Array<{ a: TemaAdmin; b: TemaAdmin; similaridade: number }>
}

export async function getTemas(): Promise<TemasAdmin> {
  const { data } = await api.get<TemasAdmin>('/admin/temas')
  return data
}

export async function criarTema(body: { nome: string; tipo: TipoTema; apelidos: string[] }): Promise<TemaAdmin> {
  const { data } = await api.post<TemaAdmin>('/admin/temas', body)
  return data
}

export async function editarTema(
  id: number, body: Partial<{ nome: string; tipo: TipoTema; apelidos: string[]; revisado: boolean; reprovado: false }>,
): Promise<TemaAdmin> {
  const { data } = await api.patch<TemaAdmin>(`/admin/temas/${id}`, body)
  return data
}

export async function juntarTema(id: number, destinoId: number): Promise<TemaAdmin> {
  const { data } = await api.post<TemaAdmin>(`/admin/temas/${id}/juntar`, { destino_id: destinoId })
  return data
}

/** Tira o tema do catálogo e dos perfis e bloqueia o nome; com substituto, quem tinha passa a ter ele */
export async function reprovarTema(id: number, substitutoId: number | null): Promise<TemaAdmin> {
  const { data } = await api.post<TemaAdmin>(`/admin/temas/${id}/reprovar`, { substituto_id: substitutoId })
  return data
}

export async function excluirTema(id: number): Promise<void> {
  await api.delete(`/admin/temas/${id}`)
}
