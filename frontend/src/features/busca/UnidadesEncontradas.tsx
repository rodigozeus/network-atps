import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconBuilding, IconChevronDown, IconChevronRight, IconUsers } from '@tabler/icons-react'
import { buscaApi } from '@shared/api/busca'
import type { BuscaUnidadesResponse, UnidadeEncontrada } from '@shared/api/types'
import styles from './UnidadesEncontradas.module.css'

const INICIAIS = 5

/** Unidades que combinam com a busca: começa fechado, numa linha discreta acima das pessoas, e
 * só abre a lista quando a pessoa pede. Some quando nada combina bem (o backend só devolve unidade
 * por nome/sigla, por quem trabalha lá ou por um trecho da competência). */
export default function UnidadesEncontradas({ q, unidade }: { q: string; unidade: number | undefined }) {
  const [r, setR] = useState<BuscaUnidadesResponse | null>(null)
  const [aberto, setAberto] = useState(false)
  const [todas, setTodas] = useState(false)

  useEffect(() => {
    setR(null)
    setAberto(false)
    setTodas(false)
    if (!q.trim()) return
    let vivo = true
    buscaApi.unidades(q, unidade).then((x) => vivo && setR(x)).catch(() => {})
    return () => { vivo = false }
  }, [q, unidade])

  if (!r || r.total === 0) return null
  const mostrar = todas ? r.itens : r.itens.slice(0, INICIAIS)
  const restantes = r.total - mostrar.length

  return (
    <section className={styles.bloco} aria-label="Unidades encontradas">
      <button type="button" className={styles.alternar} aria-expanded={aberto} aria-controls="unidades-encontradas"
        onClick={() => setAberto((v) => !v)}>
        <IconBuilding size={16} aria-hidden />
        <span>
          {r.total} {r.total === 1 ? 'unidade combina' : 'unidades combinam'}
          <span className={styles.termo}> com “{q}”</span>
        </span>
        <span className={styles.acao}>{aberto ? 'Esconder' : 'Ver unidades'}</span>
        <IconChevronDown size={16} aria-hidden className={aberto ? styles.virado : undefined} />
      </button>
      {aberto && (
        <div className={styles.painel} id="unidades-encontradas">
          <ul className={styles.lista}>
            {mostrar.map((u) => <Item key={u.id} u={u} />)}
          </ul>
          {restantes > 0 && (
            todas || r.itens.length <= INICIAIS ? (
              <p className={styles.mais}>
                E mais {restantes} {restantes === 1 ? 'unidade' : 'unidades'}. Para achar a certa, use mais palavras ou o filtro de órgão.
              </p>
            ) : (
              <button type="button" className={styles.botao} onClick={() => setTodas(true)}>
                Ver mais {r.itens.length - INICIAIS} {r.itens.length - INICIAIS === 1 ? 'unidade' : 'unidades'}
              </button>
            )
          )}
        </div>
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
