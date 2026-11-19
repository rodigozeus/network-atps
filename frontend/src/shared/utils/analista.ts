import type { AnalistaPublico, Formacao, NivelFormacao, Turma } from '@shared/api/types'

export const NIVEIS: Record<NivelFormacao, string> = {
  pos_doutorado: 'Pós-doutorado',
  doutorado: 'Doutorado',
  mestrado: 'Mestrado',
  especializacao: 'Especialização',
  graduacao: 'Graduação',
}
export const ORDEM_NIVEIS: NivelFormacao[] = ['pos_doutorado', 'doutorado', 'mestrado', 'especializacao', 'graduacao']

export const TURMAS: Record<Turma, string> = {
  turma_2012: 'Turma de 2012',
  turma_2016: 'Turma de 2016',
  turma_2024_cpnu: 'Turma de 2024 (CPNU)',
}

/** Formações da mais alta para a mais baixa */
export const ordenarFormacoes = (f: Formacao[]) =>
  [...f].sort((a, b) => ORDEM_NIVEIS.indexOf(a.nivel) - ORDEM_NIVEIS.indexOf(b.nivel))

// Cores do círculo de iniciais (fundo em gradiente + cor do texto), escolhidas pelo id
const PALETAS: Array<[string, string, string]> = [
  ['#ffe3c4', '#f7b9c9', '#7a2e4f'],
  ['#d9e8ff', '#c7c2ff', '#2b2f7a'],
  ['#d6f5e3', '#9fdcc4', '#1d5a45'],
  ['#fff1b8', '#ffcf9e', '#7a4a10'],
  ['#f6d5ff', '#ffc4d6', '#6b2160'],
  ['#d4f1ff', '#a9d8f5', '#164b6b'],
]
export function estiloPaleta(id: number): Record<string, string> {
  const [a1, a2, a3] = PALETAS[Math.abs(id) % PALETAS.length]
  return { '--a1': a1, '--a2': a2, '--a3': a3 }
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

/** Primeiro e último nome, para espaços curtos */
export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0]
}

/** foto_path vem como "uploads/fotos/x.jpg"; o nginx/Vite servem em /uploads */
export function fotoUrl(path: string | null): string | null {
  if (!path) return null
  return /^(https?:)?\//.test(path) ? path : `/${path}`
}

/** Miniatura de 240 px gravada ao lado da foto (sufixo _p), para avatares pequenos */
export function miniaturaUrl(path: string | null): string | null {
  const url = fotoUrl(path)
  return url ? url.replace(/\.[a-z]+$/i, '_p.jpg') : null
}

// Gradiente da capa por órgão: o mesmo órgão sempre recebe a mesma cor
const GRADIENTES = [
  'linear-gradient(135deg, #f5b97a 0%, #ee8fa6 48%, #7fa3f0 100%)',
  'linear-gradient(135deg, #e39ef0 0%, #f08aa8 50%, #f4b583 100%)',
  'linear-gradient(135deg, #f2c95a 0%, #8fcf73 50%, #5fb8a6 100%)',
  'linear-gradient(135deg, #82dccb 0%, #6fbcf0 50%, #9f98f0 100%)',
  'linear-gradient(135deg, #f4a473 0%, #f2cb68 50%, #a3d77c 100%)',
  'linear-gradient(135deg, #7fb8f4 0%, #9ca1f4 50%, #dc9df0 100%)',
  'linear-gradient(135deg, #f39090 0%, #f4b07c 50%, #f0d873 100%)',
  'linear-gradient(135deg, #a4dd98 0%, #7fc8d2 50%, #8fa6f2 100%)',
]
export function gradienteOrgao(chave: string | null | undefined): string {
  const texto = (chave ?? '').trim().toUpperCase()
  if (!texto) return 'linear-gradient(135deg, #ffcf9f 0%, #f6a3a8 50%, #b9b2f2 100%)'
  let h = 0
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) | 0
  return GRADIENTES[Math.abs(h) % GRADIENTES.length]
}

export interface NivelCaminho {
  nome: string | null
  sigla: string | null
}

/** Lotação completa, do ministério à coordenação (só os níveis preenchidos) */
export function lotacao(a: AnalistaPublico): NivelCaminho[] {
  return [
    { nome: a.ministerio, sigla: a.ministerio_sigla },
    { nome: a.secretaria, sigla: a.secretaria_sigla },
    { nome: a.departamento, sigla: a.departamento_sigla },
    { nome: a.coordenacao_geral, sigla: null },
    { nome: a.coordenacao, sigla: null },
  ].filter((n) => n.nome || n.sigla)
}

/** Caminho curto dos cards: só os níveis que têm sigla */
export const caminhoSiglas = (a: AnalistaPublico) => lotacao(a).filter((n) => n.sigla)

/** Nome curto do órgão para a etiqueta da capa */
export function orgaoCurto(a: AnalistaPublico): string | null {
  if (a.ministerio && a.ministerio.length <= 22) return a.ministerio
  return a.ministerio_sigla ?? a.ministerio
}

/** "+5561981413733" para links tel: e wa.me */
export function telLink(t: string): string {
  return '+55' + t.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
}
