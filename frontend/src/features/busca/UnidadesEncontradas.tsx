import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconBuilding, IconChevronRight, IconUsers } from '@tabler/icons-react'
import { buscaApi } from '@shared/api/busca'
import type { BuscaUnidadesResponse, UnidadeEncontrada } from '@shared/api/types'
import styles from './UnidadesEncontradas.module.css'

const INICIAIS = 3

/** Unidades que combinam com a busca, acima das pessoas. Some quando nada combina bem
 * (o backend só devolve unidade por nome/sigla, por quem trabalha lá ou por um trecho da competência). */
export default function UnidadesEncontradas({ q, ministerio }: { q: string; ministerio: string }) {
  const [r, setR] = useState<BuscaUnidadesResponse | null>(null)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    setR(null)
    setAberto(false)
    if (!q.trim()) return
    let vivo = true
    buscaApi.unidades(q, ministerio).then((x) => vivo && setR(x)).catch(() => {})
    return () => { vivo = false }
  }, [q, ministerio])

  if (!r || r.total === 0) return null
  const mostrar = aberto ? r.itens : r.itens.slice(0, INICIAIS)
  const restantes = r.total - mostrar.length

  return (
    <section className={styles.bloco} aria-label="Unidades encontradas">
      <h2 className={styles.titulo}>
        <IconBuilding size={18} aria-hidden /> Unidades
        <span className={styles.total}>{r.total}</span>
      </h2>
      <ul className={styles.lista}>
        {mostrar.map((u) => <Item key={u.id} u={u} />)}
      </ul>
      {restantes > 0 && (
        aberto || r.itens.length <= INICIAIS ? (
          <p className={styles.mais}>
            E mais {restantes} {restantes === 1 ? 'unidade' : 'unidades'}. Para achar a certa, use mais palavras ou o filtro de órgão.
          </p>
        ) : (
          <button type="button" className={styles.botao} onClick={() => setAberto(true)}>
            Ver mais {r.itens.length - INICIAIS} {r.itens.length - INICIAIS === 1 ? 'unidade' : 'unidades'}
          </button>
        )
      )}
    </section>
  )
}

function Item({ u }: { u: UnidadeEncontrada }) {
  const porque = u.motivo === 'pessoas'
    ? `${u.pessoas_que_fazem} ${u.pessoas_que_fazem === 1 ? 'pessoa daqui atua' : 'pessoas daqui atuam'} com isso`
    : u.motivo === 'competencia' ? 'Na competência oficial' : null
  return (
    <li>
      <Link to={`/unidades/${u.id}`} className={styles.item}>
        <span className={styles.texto}>
          {u.caminho.length > 0 && <span className={styles.caminho}>{u.caminho.join(' › ')}</span>}
          <span className={styles.nome}>
            {u.nome}{u.sigla && <span className={styles.sigla}> ({u.sigla})</span>}
          </span>
          {porque && <span className={styles.porque}>{porque}</span>}
          {u.trecho && <span className={styles.trecho}>“{u.trecho}”</span>}
        </span>
        {u.membros > 0 && (
          <span className={styles.membros} title={`${u.membros} ${u.membros === 1 ? 'pessoa' : 'pessoas'} da Rede nesta unidade`}>
            <IconUsers size={15} aria-hidden /> {u.membros}
          </span>
        )}
        <IconChevronRight size={18} aria-hidden className={styles.seta} />
      </Link>
    </li>
  )
}
