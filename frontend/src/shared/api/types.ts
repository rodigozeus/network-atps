export type Role = 'analista' | 'andeps' | 'admin'
export type NivelFormacao = 'graduacao' | 'especializacao' | 'mestrado' | 'doutorado'
export type Turma = 'turma_2012' | 'turma_2016' | 'turma_2024_cpnu'

export interface Formacao {
  id: number
  nivel: NivelFormacao
  curso: string
  instituicao: string
}

export interface Tema {
  id: number
  tema: string
  em_exercicio_atual: boolean
}

export interface AnalistaOut {
  id: number
  nome: string
  email_pessoal: string
  email_institucional: string | null
  telefone_institucional: string | null
  celular: string | null
  visibilidade_email_pessoal: boolean
  visibilidade_celular: boolean
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
  formacoes: Formacao[]
  temas: Tema[]
}

export interface AnalistaPublico {
  id: number
  nome: string
  email_pessoal: string | null
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
  formacoes: Formacao[]
  temas: Tema[]
}

export interface BuscaResponse {
  items: AnalistaPublico[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface TokenOut {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface LoginIn {
  email: string
  senha: string
}

export interface AnalistaCreate {
  nome: string
  email_pessoal: string
  senha: string
}

export interface AnalistaUpdate {
  nome?: string
  email_pessoal?: string
  email_institucional?: string
  telefone_institucional?: string
  celular?: string
  visibilidade_email_pessoal?: boolean
  visibilidade_celular?: boolean
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
}

export interface BuscaParams {
  q?: string
  ministerio?: string
  secretaria?: string
  tema?: string
  formacao?: string
  page?: number
  page_size?: number
}

export interface ApiError {
  detail: string | Array<{ loc: string[]; msg: string; type: string }>
}
