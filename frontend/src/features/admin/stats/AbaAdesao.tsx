import type { AdminStats } from '../api/admin'
import { Area1 } from './Graficos'
import { corSerie, numero, pct, periodoAnterior, porSemanaSeLonga } from './formato'
import { Cartao, Funil, Kpi } from './Pecas'
import s from './stats.module.css'

export default function AbaAdesao({ stats }: { stats: AdminStats }) {
  const a = stats.adesao
  const serie = porSemanaSeLonga(a.cadastros_por_dia, ['acumulado'])
  const semanal = serie !== a.cadastros_por_dia

  return (
    <>
      <div className={s.kpis}>
        <Kpi rotulo="Contas ativas" valor={numero(a.ativos)} />
        <Kpi
          rotulo={stats.dias ? `Novas contas (${stats.dias} dias)` : 'Novas contas'}
          valor={numero(a.novos.atual)}
          comparado={a.novos}
          anterior={periodoAnterior(stats.dias)}
        />
        <Kpi
          rotulo="Cobertura da carreira"
          valor={a.universo ? `${pct(a.ativos, a.universo)}%` : '—'}
          detalhe={a.universo ? `${numero(a.ativos)} de ${numero(a.universo)} ATPS ativos no Portal` : 'Base do Portal não importada'}
          para="/admin/cobertura"
        />
      </div>

      <div className={s.grade}>
        <Cartao
          titulo="Funil de adesão"
          subtitulo="Todas as contas ativas. Cada etapa conta só quem também passou pelas anteriores."
        >
          <Funil etapas={a.funil} />
        </Cartao>

        <Cartao
          titulo="Crescimento"
          subtitulo={`Contas ativas acumuladas${semanal ? ', por semana' : ', por dia'}. Passe o mouse para ver as novas de cada ${semanal ? 'semana' : 'dia'}.`}
        >
          <Area1
            dados={serie}
            x="dia"
            serie={{ chave: 'acumulado', nome: 'Contas ativas', cor: corSerie(1) }}
            extras={[{ chave: 'novos', nome: semanal ? 'Novas na semana' : 'Novas no dia' }]}
            altura={260}
          />
          <p className={s.nota}>
            Novas no período: {numero(a.novos.atual)}
            {serie.length > 0 && ` · maior ${semanal ? 'semana' : 'dia'}: ${numero(Math.max(...serie.map((d) => d.novos)))}`}
          </p>
        </Cartao>
      </div>
    </>
  )
}
