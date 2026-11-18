import type { EventoPerfil } from '@shared/api/types'

const ROTULOS: Record<EventoPerfil['tipo'], string> = {
  lotacao: 'Nova lotação',
  tema: 'Novo tema de atuação',
  formacao: 'Nova formação',
}

export const rotuloEvento = (e: EventoPerfil) => ROTULOS[e.tipo] ?? 'Novidade'

export const textoEvento = (e: EventoPerfil) => `${rotuloEvento(e)}: ${e.descricao}`

export const dataEvento = (e: EventoPerfil) =>
  new Date(e.criado_em).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
