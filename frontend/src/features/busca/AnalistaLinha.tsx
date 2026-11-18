import { Link } from 'react-router-dom'
import type { AnalistaPublico } from '@shared/api/types'
import { Avatar } from '@shared/components'
import { caminhoSiglas } from '@shared/utils/analista'
import { ChipsFormacao, ChipsTemas } from './Chips'
import Contatos from './Contatos'
import BotaoFavorito from './BotaoFavorito'
import MarcaNovidade from './MarcaNovidade'
import styles from './busca.module.css'

export default function AnalistaLinha({ a }: { a: AnalistaPublico }) {
  const caminho = caminhoSiglas(a)
  return (
    <article className={styles.linha} id={`analista-${a.id}`}>
      <div className={styles.lPessoa}>
        <Avatar id={a.id} nome={a.nome} fotoPath={a.foto_path} tamanho={60} className={styles.lAvatar} />
        <div className={styles.lNome}>
          <h3><Link to={`/analistas/${a.id}`}>{a.nome}</Link></h3>
          <MarcaNovidade id={a.id} className={styles.lNovidade} />
          {a.cargo_fce && <p className={styles.role}>{a.cargo_fce}</p>}
        </div>
      </div>
      <div className={styles.lOrg}>
        <span className={styles.label}>Órgão</span>
        <p className={styles.path}>
          {caminho.length
            ? caminho.map((n, i) => (
                <span key={i}>
                  {i > 0 && <span className={styles.sepPath}>›</span>}
                  <abbr title={n.nome ?? undefined}>{n.sigla}</abbr>
                </span>
              ))
            : <span className={styles.vazio}>Não informado</span>}
        </p>
      </div>
      <div className={[styles.lEdu, styles.edu].join(' ')}>
        <span className={styles.label}>Formação</span>
        <div className={styles.chips}><ChipsFormacao formacoes={a.formacoes} max={1} /></div>
      </div>
      <div className={[styles.lTemas, styles.topic].join(' ')}>
        <span className={styles.label}>Temas</span>
        <div className={styles.chips}><ChipsTemas temas={a.temas} max={1} /></div>
      </div>
      <nav className={styles.lAcoes} aria-label="Contato e favorito">
        <BotaoFavorito id={a.id} className={styles.lFav} />
        <Contatos a={a} tamanho={18} />
      </nav>
    </article>
  )
}
