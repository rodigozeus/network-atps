import type { AdminStats, Periodo } from '../api/admin'

export const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 7, rotulo: '7 dias' },
  { valor: 30, rotulo: '30 dias' },
  { valor: 90, rotulo: '90 dias' },
  { valor: 0, rotulo: 'Tudo' },
]

export const pct = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 100) : 0)

/** '2026-11-23' -> '23/11' */
export const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export const numero = (n: number) => n.toLocaleString('pt-BR')

/** "30 dias anteriores" / "7 dias anteriores" */
export const periodoAnterior = (dias: Periodo) => `${dias} dias anteriores`

/** Séries longas ("Tudo") viram semanas, para as barras não ficarem finas demais. Soma os campos
 * numéricos; `ultimo` lista os que valem pelo último dia da semana (ex.: acumulado). */
export function porSemanaSeLonga<T extends { dia: string }>(serie: T[], ultimo: string[] = []): T[] {
  if (serie.length <= 92) return serie
  const semanas = new Map<string, T>()
  for (const ponto of serie) {
    const d = new Date(`${ponto.dia}T12:00:00`)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const chave = d.toISOString().slice(0, 10)
    const atual = semanas.get(chave)
    if (!atual) {
      semanas.set(chave, { ...ponto, dia: chave })
      continue
    }
    for (const [k, v] of Object.entries(ponto)) {
      if (k === 'dia' || typeof v !== 'number') continue
      const r = atual as Record<string, unknown>
      r[k] = ultimo.includes(k) ? v : (r[k] as number) + v
    }
  }
  return [...semanas.values()]
}

/** Cores dos gráficos: lidas dos tokens do index.css (o SVG do recharts precisa do valor). */
export function corSerie(n: number): string {
  if (typeof document === 'undefined') return '#2a78d6'
  return getComputedStyle(document.documentElement).getPropertyValue(`--serie-${n}`).trim() || '#2a78d6'
}

export function corToken(nome: string, padrao: string): string {
  if (typeof document === 'undefined') return padrao
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || padrao
}

export const TIPOS_EMAIL: Record<string, string> = {
  boas_vindas: 'Boas-vindas',
  cadastro_recebido: 'Cadastro recebido',
  conta_ativada: 'Conta ativada',
  redefinicao_senha: 'Redefinição de senha',
  termos_atualizados: 'Termos atualizados',
  alerta_cpf_em_uso: 'CPF já em uso',
  vinculo_suspenso: 'Vínculo suspenso',
  conta_excluida: 'Conta excluída',
}
/** Cor fixa por tipo de e-mail (a cor segue o tipo, não a ordem em que aparece) */
export const corEmail = (tipo: string) => {
  const i = Object.keys(TIPOS_EMAIL).indexOf(tipo)
  return corSerie(i < 0 ? 8 : i + 1)
}

// --- exportação dos números agregados ---

function linhasCsv(s: AdminStats): (string | number)[][] {
  const periodo = s.dias ? `últimos ${s.dias} dias` : 'desde o início'
  const linhas: (string | number)[][] = [
    ['Seção', 'Item', 'Valor', 'Observação'],
    ['Geral', 'Gerado em', new Date(s.gerado_em).toLocaleString('pt-BR'), 'Só contas ativas; horário de Brasília'],
    ['Geral', 'Período', `${s.inicio} a ${s.fim}`, periodo],
    ['Adesão', 'Contas ativas', s.adesao.ativos, ''],
    ['Adesão', 'Novas contas no período', s.adesao.novos.atual, s.adesao.novos.anterior === null ? '' : `anterior: ${s.adesao.novos.anterior}`],
    ['Adesão', 'ATPS ativos no Portal', s.adesao.universo, ''],
    ...s.adesao.funil.map((e) => ['Funil', e.rotulo, e.total, '']),
    ['Uso', 'Visitas no período', s.uso.visitas.atual, s.uso.visitas.anterior === null ? '' : `anterior: ${s.uso.visitas.anterior}`],
    ['Uso', 'Pessoas no período', s.uso.pessoas.atual, s.uso.pessoas.anterior === null ? '' : `anterior: ${s.uso.pessoas.anterior}`],
    ['Uso', 'Pessoas nos últimos 7 dias', s.uso.semana, ''],
    ['Uso', 'Pessoas nos últimos 30 dias', s.uso.mes, ''],
    ['Uso', 'Voltaram em até 7 dias', s.uso.retorno.voltaram, `de ${s.uso.retorno.elegiveis}`],
    ['Uso', 'Favoritos', s.uso.favoritos.total, ''],
    ['Uso', 'Pessoas que favoritaram', s.uso.favoritos.pessoas, ''],
    ['Perfis', 'Perfis ocultos', s.perfis.ocultos, ''],
    ['Perfis', 'Com função comissionada', s.perfis.com_funcao, ''],
    ['Perfis', 'Perfis completos', s.perfis.completos, ''],
    ...s.perfis.completude.map((c) => ['Completude', c.rotulo, c.total, `de ${s.perfis.ativos}`]),
    ...s.perfis.por_orgao.map((g) => ['Órgão', g.rotulo, g.total, '']),
    ...s.perfis.por_tema.map((g) => ['Tema', g.rotulo, g.total, '']),
    ...s.perfis.por_formacao.map((g) => ['Formação mais alta', g.rotulo, g.total, '']),
    ...s.perfis.por_turma.map((g) => ['Turma', g.rotulo, g.total, '']),
    ...s.adesao.cadastros_por_dia.map((d) => ['Novas contas por dia', d.dia, d.novos, `acumulado: ${d.acumulado}`]),
    ...s.uso.visitas_por_dia.map((d) => ['Visitas por dia', d.dia, d.visitas, `pessoas: ${d.pessoas}`]),
  ]
  return linhas
}

export function baixarCsv(s: AdminStats) {
  const celula = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  // ; e BOM: o Excel em português abre direto, com acentos
  const texto = '﻿' + linhasCsv(s).map((l) => l.map(celula).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `estatisticas-rede-atps-${s.fim}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
