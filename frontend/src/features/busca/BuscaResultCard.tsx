import { Link } from 'react-router-dom'
import type { AnalistaPublico } from '@shared/api/types'
import { Tag } from '@shared/components'
import styles from './busca.module.css'

function getInitials(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function buildOrgBreadcrumb(p: AnalistaPublico): string {
  const parts: string[] = []
  if (p.ministerio_sigla ?? p.ministerio) parts.push((p.ministerio_sigla ?? p.ministerio)!)
  if (p.secretaria_sigla ?? p.secretaria) parts.push((p.secretaria_sigla ?? p.secretaria)!)
  if (p.departamento_sigla ?? p.departamento) parts.push((p.departamento_sigla ?? p.departamento)!)
  return parts.join(' › ')
}

const MAX_TEMAS = 3

export default function BuscaResultCard({ analista }: { analista: AnalistaPublico }) {
  const org = buildOrgBreadcrumb(analista)
  const temasVisiveis = analista.temas.slice(0, MAX_TEMAS)
  const temasExtra = analista.temas.length - temasVisiveis.length

  return (
    <Link to={`/analistas/${analista.id}`} className={styles.resultCard}>
      {analista.foto_path ? (
        <img
          src={`/${analista.foto_path}`}
          alt={analista.nome}
          className={styles.resultAvatarImg}
        />
      ) : (
        <div className={styles.resultAvatarInitials}>{getInitials(analista.nome)}</div>
      )}

      <div className={styles.resultCardBody}>
        <div className={styles.resultName}>{analista.nome}</div>
        {analista.cargo_fce && (
          <div className={styles.resultCargo}>{analista.cargo_fce}</div>
        )}
        {org && <div className={styles.resultOrg}>{org}</div>}
        {analista.temas.length > 0 && (
          <div className={styles.resultTemas}>
            {temasVisiveis.map((t) => (
              <Tag
                key={t.id}
                variant={t.em_exercicio_atual ? 'success' : 'neutral'}
                active={t.em_exercicio_atual}
              >
                {t.tema}
              </Tag>
            ))}
            {temasExtra > 0 && (
              <span className={styles.temasExtra}>+{temasExtra}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
