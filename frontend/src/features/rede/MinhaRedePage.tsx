import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconSparkles } from '@tabler/icons-react'
import type { MinhaRedePagina } from '@shared/api/types'
import { redeApi } from '@shared/api/unidades'
import { Avatar, Spinner } from '@shared/components'
import { nomeCurto } from '@shared/utils/analista'
import AnalistaLinha from '@features/busca/AnalistaLinha'
import busca from '@features/busca/busca.module.css'
import Orbitas, { MOTIVO_DO_ANEL } from './Orbitas'
import styles from './rede.module.css'

/** Minha rede: você no centro e, em anéis, quem está mais perto de você e por quê. */
export default function MinhaRedePage() {
  const [d, setD] = useState<MinhaRedePagina | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    redeApi.pagina().then(setD).catch(() => setErro(true))
    document.title = 'Minha rede · Rede ATPS'
    return () => { document.title = 'Rede ATPS' }
  }, [])

  if (erro) return <p className={styles.vazio}>Não foi possível carregar sua rede. Tente de novo.</p>
  if (!d) return <div className={styles.carregando}><Spinner size="lg" /></div>

  return (
    <div className={styles.pagina}>
      <header className={styles.topo}>
        <h1>Minha rede</h1>
        <p>Quem da carreira está perto de você, pela lotação e pelos temas em que você atua.</p>
      </header>

      {d.aneis.length > 0 ? (
        <Orbitas eu={d.eu} aneis={d.aneis} />
      ) : (
        <p className={styles.vazio}>Ainda não há ninguém da Rede na sua lotação, nos seus temas ou nos seus favoritos.</p>
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
              <div key={p.analista.id} className={styles.item}>
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
