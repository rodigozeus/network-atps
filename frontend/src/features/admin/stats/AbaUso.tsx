import type { AdminStats } from '../api/admin'
import { Linhas, Pilhas } from './Graficos'
import { TIPOS_EMAIL, corEmail, corSerie, diaCurto, numero, pct, periodoAnterior, porSemanaSeLonga } from './formato'
import { Cartao, Kpi, Vazio } from './Pecas'
import s from './stats.module.css'

export default function AbaUso({ stats }: { stats: AdminStats }) {
  const u = stats.uso
  const ativos = stats.adesao.ativos
  const anterior = periodoAnterior(stats.dias)
  const sufixo = stats.dias ? ` (${stats.dias} dias)` : ''

  const visitas = porSemanaSeLonga(u.visitas_por_dia)
  const visitasSemanal = visitas !== u.visitas_por_dia
  const emails = porSemanaSeLonga(u.emails_por_dia)
  const emailsSemanal = emails !== u.emails_por_dia
  const maiorDiaEmail = Math.max(0, ...u.emails_por_dia.map((d) =>
    u.emails_tipos.reduce((soma, t) => soma + Number(d[t] ?? 0), 0)))
  const totalEmails = u.emails_por_dia.reduce((soma, d) =>
    soma + u.emails_tipos.reduce((x, t) => x + Number(d[t] ?? 0), 0), 0)
  const temAtualizacoes = u.atualizacoes_por_semana.some((w) => w.lotacao + w.tema + w.formacao > 0)

  return (
    <>
      <div className={s.kpis}>
        <Kpi rotulo={`Visitas${sufixo}`} valor={numero(u.visitas.atual)} comparado={u.visitas} anterior={anterior} />
        <Kpi rotulo={`Pessoas que abriram a Rede${sufixo}`} valor={numero(u.pessoas.atual)} comparado={u.pessoas} anterior={anterior} />
        <Kpi
          rotulo="Pessoas na semana · no mês"
          valor={<>{numero(u.semana)} <span className={s.kpiValorSecundario}>· {numero(u.mes)}</span></>}
          detalhe={`${pct(u.mes, ativos)}% das contas ativas abriram a Rede nos últimos 30 dias`}
        />
        <Kpi
          rotulo="Voltaram em até 7 dias"
          valor={u.retorno.elegiveis ? `${pct(u.retorno.voltaram, u.retorno.elegiveis)}%` : '—'}
          detalhe={u.retorno.elegiveis
            ? `${numero(u.retorno.voltaram)} de ${numero(u.retorno.elegiveis)} que abriram a Rede pela 1ª vez há 7 dias ou mais`
            : 'Ainda ninguém abriu a Rede pela 1ª vez há 7 dias ou mais'}
        />
      </div>

      <div className={s.grade}>
        <Cartao
          largo
          titulo="Visitas"
          subtitulo={`Uma visita = a Rede aberta numa sessão do navegador. ${visitasSemanal ? 'Por semana' : 'Por dia'}; pessoas diferentes em cada ${visitasSemanal ? 'semana' : 'dia'}.`}
        >
          <Linhas
            dados={visitas}
            x="dia"
            series={[
              { chave: 'visitas', nome: 'Visitas', cor: corSerie(1) },
              { chave: 'pessoas', nome: 'Pessoas', cor: corSerie(2) },
            ]}
          />
        </Cartao>

        <Cartao titulo="Favoritos" subtitulo="Entre contas ativas">
          <div className={s.miniKpis}>
            <Kpi rotulo="Favoritos" valor={numero(u.favoritos.total)} />
            <Kpi
              rotulo="Pessoas que favoritaram"
              valor={numero(u.favoritos.pessoas)}
              detalhe={u.favoritos.pessoas
                ? `${pct(u.favoritos.pessoas, ativos)}% das contas · média de ${(u.favoritos.total / u.favoritos.pessoas).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por pessoa`
                : undefined}
            />
            <Kpi rotulo={`Novos${sufixo}`} valor={numero(u.favoritos.novos.atual)} comparado={u.favoritos.novos} anterior={anterior} />
          </div>
        </Cartao>

        <Cartao
          titulo="Atualizações de perfil"
          subtitulo="Por semana, nas últimas 12 semanas: mudanças que viram novidade para quem favoritou a pessoa"
        >
          {temAtualizacoes ? (
            <Pilhas
              dados={u.atualizacoes_por_semana}
              x="semana"
              series={[
                { chave: 'lotacao', nome: 'Lotação', cor: corSerie(1) },
                { chave: 'tema', nome: 'Tema novo', cor: corSerie(2) },
                { chave: 'formacao', nome: 'Formação nova', cor: corSerie(3) },
              ]}
            />
          ) : <Vazio>Nenhuma atualização nas últimas 12 semanas.</Vazio>}
        </Cartao>

        <Cartao
          largo
          titulo="E-mails enviados"
          subtitulo={`${emailsSemanal ? 'Por semana' : 'Por dia'}, por tipo. Acima de ${numero(u.emails_limite_dia)} por dia (ou 100 por hora), só saem os essenciais: senha, ativação, vínculo.`}
          acao={
            <p className={s.cartaoNumero}>
              Maior dia: <strong>{numero(maiorDiaEmail)}</strong> de {numero(u.emails_limite_dia)}
            </p>
          }
        >
          {totalEmails ? (
            <Pilhas
              dados={emails}
              x="dia"
              rotuloX={diaCurto}
              series={u.emails_tipos.map((t) => ({ chave: t, nome: TIPOS_EMAIL[t] ?? t, cor: corEmail(t) }))}
              // a linha do limite só aparece quando o volume chega perto dele (senão achata o gráfico)
              limite={!emailsSemanal && maiorDiaEmail > u.emails_limite_dia / 2
                ? { valor: u.emails_limite_dia, rotulo: 'limite diário' } : undefined}
            />
          ) : <Vazio>Nenhum e-mail enviado no período.</Vazio>}
        </Cartao>
      </div>
    </>
  )
}
