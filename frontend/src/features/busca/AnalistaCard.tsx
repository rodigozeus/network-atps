import { Link } from 'react-router-dom'
import { IconBriefcase, IconSchool } from '@tabler/icons-react'
import type { AnalistaPublico } from '@shared/api/types'
import { Avatar } from '@shared/components'
import { caminhoSiglas, gradienteOrgao, orgaoCurto } from '@shared/utils/analista'
import { ChipsFormacao, ChipsTemas } from './Chips'
import Contatos from './Contatos'
import BotaoFavorito from './BotaoFavorito'
import MarcaNovidade from './MarcaNovidade'
import styles from './busca.module.css'

export default function AnalistaCard({ a }: { a: AnalistaPublico }) {
  const caminho = caminhoSiglas(a)
  const org = orgaoCurto(a)
  return (
    <article className={styles.card} id={`analista-${a.id}`}>
      <div className={styles.cover} style={{ background: gradienteOrgao(a.ministerio_sigla ?? a.ministerio) }}>
        <img className={styles.coverArt} src="/ministerio.png" alt="" />
        {org && <span className={styles.orgTag}>{org}</span>}
        <MarcaNovidade id={a.id} className={styles.novidade} />
        <BotaoFavorito id={a.id} className={styles.fav} classeAviso={styles.favMsg} />
      </div>
      <div className={styles.inner}>
        <div className={styles.head}>
          <Link to={`/analistas/${a.id}`} className={styles.avatarLink} tabIndex={-1} aria-hidden>
            <Avatar id={a.id} nome={a.nome} fotoPath={a.foto_path} tamanho={120} className={styles.avatar} />
          </Link>
          {caminho.length > 0 && (
            <p className={styles.path}>
              {caminho.map((n, i) => (
                <span key={i}>
                  {i > 0 && <span className={styles.sepPath}>›</span>}
                  <abbr title={n.nome ?? undefined}>{n.sigla}</abbr>
                </span>
              ))}
            </p>
          )}
        </div>
        <div className={styles.body}>
          <h3><Link to={`/analistas/${a.id}`}>{a.nome}</Link></h3>
          {a.cargo_fce && <p className={styles.role}>{a.cargo_fce}</p>}
          <div className={styles.rows}>
            <div className={styles.edu}>
              <div className={styles.groupHead}><span className={styles.ico}><IconSchool size={14} aria-hidden /></span><span className={styles.label}>Formação acadêmica</span></div>
              <div className={styles.chips}><ChipsFormacao formacoes={a.formacoes} /></div>
            </div>
            <div className={styles.topic}>
              <div className={styles.groupHead}><span className={styles.ico}><IconBriefcase size={14} aria-hidden /></span><span className={styles.label}>Temas de atuação</span></div>
              <div className={styles.chips}><ChipsTemas temas={a.temas} /></div>
            </div>
          </div>
          <nav className={styles.actions} aria-label="Contato">
            <Contatos a={a} tamanho={22} envolver={(i) => <span className={styles.btn}>{i}</span>} />
          </nav>
        </div>
      </div>
    </article>
  )
}
