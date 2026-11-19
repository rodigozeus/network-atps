import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconBrandWhatsapp, IconCheck, IconCopy, IconSparkles, IconUserPlus } from '@tabler/icons-react'
import type { MinhaRedePagina } from '@shared/api/types'
import { redeApi } from '@shared/api/unidades'
import { Avatar, Spinner } from '@shared/components'
import { nomeCurto } from '@shared/utils/analista'
import AnalistaLinha from '@features/busca/AnalistaLinha'
import busca from '@features/busca/busca.module.css'
import Orbitas, { MOTIVO_DO_ANEL } from './Orbitas'
import styles from './rede.module.css'

const CONVITE = 'Oi! Estou na Rede ATPS, a rede dos Analistas Técnicos de Políticas Sociais. '
  + 'Dá para encontrar colegas por tema e por órgão. Entra lá: https://redeatps.org/sobre'

/** Minha rede: você no centro e, em anéis, quem está mais perto de você e por quê. */
export default function MinhaRedePage() {
  const [d, setD] = useState<MinhaRedePagina | null>(null)
  const [erro, setErro] = useState(false)
  const [tema, setTema] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    redeApi.pagina().then(setD).catch(() => setErro(true))
    document.title = 'Minha rede · Rede ATPS'
    return () => { document.title = 'Rede ATPS' }
  }, [])

  if (erro) return <p className={styles.vazio}>Não foi possível carregar sua rede. Tente de novo.</p>
  if (!d) return <div className={styles.carregando}><Spinner size="lg" /></div>

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(CONVITE)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1800)
    } catch { /* sem área de transferência */ }
  }
  const temaInfo = d.temas.find((t) => t.tema === tema)

  return (
    <div className={styles.pagina}>
      <header className={styles.topo}>
        <h1>Minha rede</h1>
        <p>Quem da carreira está perto de você, pela lotação e pelos temas em que você atua.</p>
      </header>

      {d.temas.length > 0 && (
        <section className={styles.temas} aria-label="Seus temas">
          <span className={styles.rotulo}>Seus temas</span>
          <div className={styles.chips}>
            {d.temas.map((t) => (
              <button key={t.tema} type="button" aria-pressed={tema === t.tema}
                onClick={() => setTema(tema === t.tema ? null : t.tema)}>
                {t.tema} <small>{t.total}</small>
              </button>
            ))}
          </div>
          {temaInfo && (
            <p className={styles.temaInfo}>
              {temaInfo.total === 0
                ? <>Ninguém mais na Rede informou “{temaInfo.tema}” ainda.</>
                : <>Destacadas abaixo as pessoas perto de você que atuam com “{temaInfo.tema}”. <Link to={`/busca?tema=${encodeURIComponent(temaInfo.tema)}`}>Ver as {temaInfo.total} na Rede</Link></>}
            </p>
          )}
        </section>
      )}

      {d.aneis.length > 0 ? (
        <Orbitas eu={d.eu} aneis={d.aneis} tema={tema} />
      ) : (
        <p className={styles.vazio}>Ainda não há ninguém da Rede na sua lotação, nos seus temas ou nos seus favoritos.</p>
      )}

      {d.vazios.length > 0 && (
        <section className={styles.convite}>
          <IconUserPlus size={22} aria-hidden />
          <div>
            <p>
              Ninguém da Rede ainda {d.vazios.slice(0, 2).map((v, i) => (
                <span key={v.nivel}>{i > 0 ? ' nem ' : 'na '}{v.titulo.replace(/^sua |^seu /, (m) => m)} (<b>{v.nome}</b>)</span>
              ))}. Convide colegas da carreira:
            </p>
            <div className={styles.conviteAcoes}>
              <a href={`https://wa.me/?text=${encodeURIComponent(CONVITE)}`} target="_blank" rel="noopener noreferrer" className={styles.botao}>
                <IconBrandWhatsapp size={18} aria-hidden />Convidar pelo WhatsApp
              </a>
              <button type="button" className={[styles.botao, styles.secundario].join(' ')} onClick={() => void copiar()}>
                {copiado ? <IconCheck size={18} aria-hidden /> : <IconCopy size={18} aria-hidden />}{copiado ? 'Convite copiado' : 'Copiar convite'}
              </button>
            </div>
          </div>
        </section>
      )}

      {d.recentes.length > 0 && (
        <section className={styles.recentes} aria-labelledby="titulo-recentes">
          <h2 id="titulo-recentes"><IconSparkles size={18} aria-hidden />Chegaram perto de você</h2>
          <ul>
            {d.recentes.map((a) => (
              <li key={a.id}>
                <Link to={`/analistas/${a.id}`}>
                  <Avatar id={a.id} nome={a.nome} fotoPath={a.foto_path} tamanho={56} />
                  <span>{nomeCurto(a.nome)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.aneis.map((anel) => (
        <section key={anel.chave} id={`anel-${anel.chave}`} className={styles.grupo}>
          <h2>
            {anel.titulo}{anel.unidade && <span> · {anel.unidade}</span>}
            <small>{anel.total} {anel.total === 1 ? 'pessoa' : 'pessoas'}</small>
          </h2>
          <div className={busca.linhas}>
            {anel.pessoas.map((p) => (
              <div key={p.analista.id} className={[styles.item, tema && !p.temas_comuns.includes(tema) ? styles.apagado : ''].join(' ')}>
                {(anel.chave === 'temas' || p.temas_comuns.length > 0) && (
                  <p className={styles.motivo}>{anel.chave === 'temas' ? '' : `${MOTIVO_DO_ANEL[anel.chave]} · `}Em comum: {p.temas_comuns.join(', ')}</p>
                )}
                <AnalistaLinha a={p.analista} />
              </div>
            ))}
          </div>
          {anel.total > anel.pessoas.length && (
            <p className={styles.mais}>E mais {anel.total - anel.pessoas.length}. Use a busca para ver todos.</p>
          )}
        </section>
      ))}
    </div>
  )
}
