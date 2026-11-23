import type { AdminStats } from '../api/admin'
import { numero, pct } from './formato'
import { Barras, Cartao, Completude, Kpi, NotaOutros } from './Pecas'
import s from './stats.module.css'

export default function AbaPerfis({ stats }: { stats: AdminStats }) {
  const p = stats.perfis
  return (
    <>
      <div className={s.kpis}>
        <Kpi rotulo="Contas ativas" valor={numero(p.ativos)} />
        <Kpi rotulo="Perfis completos" valor={`${pct(p.completos, p.ativos)}%`}
          detalhe={`${numero(p.completos)} com todos os itens abaixo`} />
        <Kpi rotulo="Perfis ocultos" valor={numero(p.ocultos)}
          detalhe={`${pct(p.ocultos, p.ativos)}% escolheram não aparecer na busca`} />
        <Kpi rotulo="Com função comissionada" valor={`${pct(p.com_funcao, p.ativos)}%`}
          detalhe={`${numero(p.com_funcao)} informaram cargo ou função`} />
      </div>

      <div className={s.grade}>
        <Cartao largo titulo="Completude dos perfis" subtitulo="Quantas contas ativas têm cada item preenchido">
          <Completude itens={p.completude} base={p.ativos} />
        </Cartao>

        <Cartao titulo="Por órgão" subtitulo="Os 10 com mais contas (pela lotação SIORG ou pelo ministério informado)">
          <Barras grupos={p.por_orgao} base={p.ativos} titulo="Órgão" />
        </Cartao>
        <Cartao titulo="Temas mais frequentes" subtitulo="Os 10 temas do catálogo com mais pessoas">
          <Barras grupos={p.por_tema} base={p.ativos} titulo="Tema" />
        </Cartao>
        <Cartao titulo="Formação mais alta" subtitulo="Cada pessoa conta uma vez, pelo nível mais alto">
          <Barras grupos={p.por_formacao} base={p.ativos} titulo="Formação mais alta" />
        </Cartao>
        <Cartao titulo="Turma de ingresso">
          <Barras grupos={p.por_turma} base={p.ativos} titulo="Turma" />
        </Cartao>
      </div>
      <NotaOutros minimo={stats.minimo_grupo} />
    </>
  )
}
