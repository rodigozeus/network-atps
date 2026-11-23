import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { IconCheck, IconDownload, IconRefresh } from '@tabler/icons-react'
import type { AdminStats, PendenciasAdmin, Periodo } from '../api/admin'
import { getStats } from '../api/admin'
import { useAdmin } from '../AdminLayout'
import AbaAdesao from './AbaAdesao'
import AbaPerfis from './AbaPerfis'
import AbaUso from './AbaUso'
import { PERIODOS, baixarCsv, numero } from './formato'
import s from './stats.module.css'

const ABAS = [
  { chave: 'adesao', rotulo: 'Adesão' },
  { chave: 'uso', rotulo: 'Uso' },
  { chave: 'perfis', rotulo: 'Perfis' },
] as const
type Aba = (typeof ABAS)[number]['chave']

function lerPeriodo(v: string | null): Periodo {
  const n = Number(v)
  return v !== null && [0, 7, 30, 90].includes(n) ? (n as Periodo) : 30
}

export default function StatsPage() {
  const [params, setParams] = useSearchParams()
  const aba: Aba = ABAS.some((a) => a.chave === params.get('aba')) ? (params.get('aba') as Aba) : 'adesao'
  const dias = lerPeriodo(params.get('dias'))
  const { pendencias, recarregarPendencias } = useAdmin()

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const pedido = useRef(0)

  const carregar = useCallback((d: Periodo) => {
    const meu = ++pedido.current
    setCarregando(true)
    setErro(null)
    getStats(d)
      .then((r) => { if (meu === pedido.current) setStats(r) })
      .catch((e: { response?: { status?: number; data?: { detail?: string } }; message?: string }) => {
        if (meu !== pedido.current) return
        const status = e.response?.status
        setErro(e.response?.data?.detail ?? (status ? `Erro ${status} no servidor.` : e.message ?? 'Sem conexão.'))
      })
      .finally(() => { if (meu === pedido.current) setCarregando(false) })
  }, [])

  useEffect(() => carregar(dias), [dias, carregar])

  function mudar(chave: string, valor: string) {
    const novo = new URLSearchParams(params)
    novo.set(chave, valor)
    setParams(novo, { replace: true })
  }

  function recarregar() {
    carregar(dias)
    recarregarPendencias()
  }

  const gerado = stats ? new Date(stats.gerado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div>
      <header className={s.topo}>
        <div>
          <h1 className={s.titulo}>Estatísticas</h1>
          <p className={s.subtitulo}>Só contas ativas · horário de Brasília{gerado && ` · atualizado às ${gerado}`}</p>
        </div>
        <div className={s.acoes}>
          <button type="button" className={s.botao} onClick={recarregar} disabled={carregando}>
            <IconRefresh size={16} aria-hidden className={carregando ? s.girando : undefined} />
            Recarregar
          </button>
          <button type="button" className={s.botao} onClick={() => stats && baixarCsv(stats)} disabled={!stats}>
            <IconDownload size={16} aria-hidden />
            Exportar CSV
          </button>
        </div>
      </header>

      <Pendencias p={pendencias} />

      <div className={s.barraAbas}>
        <div className={s.abas} role="tablist" aria-label="Seções">
          {ABAS.map((a) => (
            <button key={a.chave} type="button" role="tab" aria-selected={aba === a.chave}
              className={`${s.aba} ${aba === a.chave ? s.abaAtiva : ''}`} onClick={() => mudar('aba', a.chave)}>
              {a.rotulo}
            </button>
          ))}
        </div>
        {aba === 'perfis' ? (
          <p className={s.retrato}>Retrato de hoje</p>
        ) : (
          <div className={s.periodos} role="group" aria-label="Período">
            {PERIODOS.map((p) => (
              <button key={p.valor} type="button" aria-pressed={dias === p.valor}
                className={`${s.periodo} ${dias === p.valor ? s.periodoAtivo : ''}`}
                onClick={() => mudar('dias', String(p.valor))}>
                {p.rotulo}
              </button>
            ))}
          </div>
        )}
      </div>

      {erro && (
        <div className={s.erro} role="alert">
          <span>Não foi possível carregar as estatísticas. {erro}</span>
          <button type="button" className={s.botao} onClick={recarregar}>Tentar de novo</button>
        </div>
      )}

      {!stats && carregando && <p className={s.vazio}>Carregando…</p>}

      {stats && (
        <div className={carregando ? s.atualizando : undefined} aria-busy={carregando}>
          {aba === 'adesao' && <AbaAdesao stats={stats} />}
          {aba === 'uso' && <AbaUso stats={stats} />}
          {aba === 'perfis' && <AbaPerfis stats={stats} />}
        </div>
      )}
    </div>
  )
}

/** O que espera ação do admin; some quando não há nada. */
function Pendencias({ p }: { p: PendenciasAdmin | null }) {
  if (!p) return null
  const motivo = p.revisao_motivos[0]
  const itens = [
    {
      n: p.revisao, para: '/admin/usuarios?filtro=pendentes',
      rotulo: p.revisao === 1 ? 'cadastro aguarda revisão' : 'cadastros aguardam revisão',
      detalhe: motivo ? `${p.revisao_motivos.length > 1 ? 'Mais comum: ' : ''}${motivo.motivo}` : undefined,
    },
    { n: p.vinculo, para: '/admin/usuarios?filtro=vinculo', rotulo: p.vinculo === 1 ? 'alerta de vínculo' : 'alertas de vínculo' },
    { n: p.conflitos, para: '/admin/conflitos', rotulo: p.conflitos === 1 ? 'conflito de CPF' : 'conflitos de CPF' },
    { n: p.temas, para: '/admin/temas', rotulo: p.temas === 1 ? 'tema novo para revisar' : 'temas novos para revisar' },
    {
      n: p.bloqueadas, para: '/admin/usuarios?filtro=todos&bloqueado=1&titulo=Login%20bloqueado',
      rotulo: p.bloqueadas === 1 ? 'conta com login bloqueado' : 'contas com login bloqueado',
      detalhe: 'Por senha errada; libera sozinho',
      info: true,
    },
  ].filter((i) => i.n > 0)

  if (itens.length === 0) {
    return (
      <p className={s.semPendencias}>
        <IconCheck size={16} aria-hidden /> Nada esperando ação do admin.
      </p>
    )
  }
  return (
    <ul className={s.pendencias} aria-label="Pendências">
      {itens.map((i) => (
        <li key={i.para}>
          <Link to={i.para} className={`${s.pendencia} ${'info' in i ? s.pendenciaInfo : ''}`} title={i.detalhe}>
            <strong className={s.pendenciaNumero}>{numero(i.n)}</strong>
            <span>
              {i.rotulo}
              {i.detalhe && <small className={s.pendenciaDetalhe}>{i.detalhe}</small>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
