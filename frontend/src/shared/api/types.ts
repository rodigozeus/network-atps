export type Role = 'analista' | 'andeps' | 'admin'
export type NivelFormacao = 'graduacao' | 'especializacao' | 'mestrado' | 'doutorado' | 'pos_doutorado'
export type Turma = 'turma_2012' | 'turma_2016' | 'turma_2024_cpnu'
export type Pendencia = 'cpf' | 'termos' | 'vinculo'

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
  linkedin_url: string | null
  lattes_url: string | null
  turma: Turma | null
  foto_path: string | null
  role: Role
  ativo: boolean
  pendente_revisao: boolean
  perfil_oculto: boolean
  /** cpf: informar CPF; termos: aceitar versão atual; vinculo: vínculo suspenso */
  pendencias: Pendencia[]
  motivo_pendencia: string | null
  vinculo_suspenso_em: string | null
  vinculo_exclusao_em: string | null
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
  linkedin_url: string | null
  lattes_url: string | null
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

export interface RegistroOut {
  ativo: boolean
  motivo: string | null
}

export interface LoginIn {
  email: string
  senha: string
}

export interface AnalistaCreate {
  nome: string
  email_pessoal: string
  senha: string
  cpf: string
  aceite_termos: boolean
  aceite_consulta_cpf: boolean
  /** Versão de cada documento exibida ao usuário */
  versoes: Record<string, number>
}

export interface RegularizarIn {
  cpf?: string
  aceite_termos: boolean
  aceite_consulta_cpf: boolean
  versoes: Record<string, number>
}

export interface DocumentoLegal {
  tipo: string
  versao: number
  vigente_desde: string
  titulo: string
  texto: string
  hash: string
}

export interface Consentimento {
  tipo: string
  acao: 'aceito' | 'revogado'
  documento_versao: number | null
  criado_em: string
}

export interface AnalistaUpdate {
  nome?: string
  email_pessoal?: string
  email_institucional?: string
  telefone_institucional?: string
  celular?: string
  visibilidade_email_pessoal?: boolean
  visibilidade_celular?: boolean
  perfil_oculto?: boolean
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
  linkedin_url?: string
  lattes_url?: string
  turma?: Turma
}

export interface BuscaParams {
  q?: string
  ministerio?: string
  secretaria?: string
  tema?: string
  formacao?: string
  /** Novo no back-end: filtra pelo nível da formação (ver docs/NOVO-VISUAL.md) */
  nivel_formacao?: NivelFormacao
  /** Novo no back-end: só analistas favoritados por quem está logado */
  favoritos?: boolean
  page?: number
  page_size?: number
}

/** Níveis da lotação, do ministério até a coordenação */
export type NivelLotacao = 'ministerio' | 'secretaria' | 'departamento' | 'coordenacao_geral' | 'coordenacao'

/** Item de GET /lotacoes (novo no back-end): uma lotação já cadastrada na rede */
export interface Lotacao {
  nome: string
  sigla: string | null
  total: number
}

/** Item de GET /temas (novo no back-end): tema de atuação e quantas pessoas o citam */
export interface TemaCatalogo {
  tema: string
  total: number
}

export interface ApiError {
  detail: string | Array<{ loc: string[]; msg: string; type: string }>
}
