import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconSearch } from '@tabler/icons-react'
import type { OrgaoResumo } from '@shared/api/types'
import { unidadesApi } from '@shared/api/unidades'
import { Spinner } from '@shared/components'
import perfil from '@features/perfil/perfil.module.css'
import styles from './unidades.module.css'

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Órgãos da estrutura oficial, com quantas pessoas da Rede estão em cada um. */
export default function UnidadesPage() {
  const [orgaos, setOrgaos] = useState<OrgaoResumo[] | null>(null)
  const [erro, setErro] = useState(false)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    unidadesApi.orgaos().then(setOrgaos).catch(() => setErro(true))
  }, [])

  useEffect(() => {
    document.title = 'Órgãos e unidades · Rede ATPS'
    return () => { document.title = 'Rede ATPS' }
  }, [])

  const visiveis = useMemo(() => {
    const f = semAcento(filtro.trim())
    return (orgaos ?? []).filter((o) => !f || semAcento(`${o.nome} ${o.sigla ?? ''}`).includes(f))
  }, [orgaos, filtro])

  return (
    <>
      <div className={perfil.hero} />
      <div className={perfil.perfil}>
        <article className={[perfil.ficha, styles.ficha].join(' ')} data-barra-limite>
          <header className={styles.topo}>
            <span className={styles.nivel}>Estrutura oficial do Governo Federal</span>
            <h1>Órgãos e unidades</h1>
            <p className={styles.resumo}>
              Veja o que cada órgão e cada unidade faz, o contato institucional e quem da Rede está lá.
            </p>
          </header>

          <label className={styles.filtro}>
            <IconSearch size={18} aria-hidden />
            <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por nome ou sigla" aria-label="Filtrar órgãos" />
          </label>

          {erro ? (
            <p className={styles.fonte}>Não foi possível carregar os órgãos. Tente de novo.</p>
          ) : !orgaos ? (
            <div className={perfil.carregando}><Spinner size="lg" /></div>
          ) : (
            <ul className={styles.orgaos}>
              {visiveis.map((o) => (
                <li key={o.id}>
                  <Link to={`/unidades/${o.id}`}>
                    <span><b>{o.sigla ?? o.nome}</b>{o.sigla && <small>{o.nome}</small>}</span>
                    {o.membros > 0 && <em>{o.membros} {o.membros === 1 ? 'pessoa' : 'pessoas'}</em>}
                  </Link>
                </li>
              ))}
              {!visiveis.length && <li className={styles.fonte}>Nenhum órgão com esse nome.</li>}
            </ul>
          )}
        </article>
      </div>
    </>
  )
}
