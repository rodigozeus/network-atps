import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconRefresh, IconUserPlus, IconX } from '@tabler/icons-react'
import type { AnalistaPublico, NovidadesRede as Novidades } from '@shared/api/types'
import { redeApi } from '@shared/api/unidades'
import { Avatar } from '@shared/components'
import { useAuth } from '@shared/hooks/useAuth'
import { TURMAS, nomeCurto } from '@shared/utils/analista'
import styles from './busca.module.css'

const MOSTRAR = 4

function Pessoas({ pessoas }: { pessoas: AnalistaPublico[] }) {
  const extra = pessoas.length - MOSTRAR
  return (
    <span className={styles.chegaramPessoas}>
      {pessoas.slice(0, MOSTRAR).map((p, i) => (
        <span key={p.id}>
          {i > 0 && (i === Math.min(pessoas.length, MOSTRAR) - 1 && extra <= 0 ? ' e ' : ', ')}
          <Link to={`/analistas/${p.id}`}>
            <Avatar id={p.id} nome={p.nome} fotoPath={p.foto_path} tamanho={24} />
            {nomeCurto(p.nome)}
          </Link>
        </span>
      ))}
      {extra > 0 && <span> e mais {extra}</span>}
    </span>
  )
}

/** Faixa no alto da busca: quem chegou na sua unidade ou turma e sugestão de atualizar o perfil. */
export default function NovidadesRede() {
  const { user } = useAuth()
  const [n, setN] = useState<Novidades | null>(null)

  useEffect(() => {
    redeApi.novidades().then(setN).catch(() => {})
  }, [])

  const fechar = () => {
    setN(null)
    void redeApi.marcarVistas().catch(() => {})
  }

  const temNovidade = !!n && (n.chegaram_unidade.length > 0 || n.chegaram_turma.length > 0)
  const sugestao = !!user?.sugestao_atualizacao
  if (!temNovidade && !sugestao) return null

  return (
    <div className={styles.novidadesRede}>
      {sugestao && (
        <p className={styles.novidadeLinha}>
          <IconRefresh size={18} aria-hidden />
          <span>Seu exercício no Portal da Transparência parece diferente do seu perfil. <Link to="/perfil">Revisar</Link></span>
        </p>
      )}
      {temNovidade && n && (
        <div className={styles.novidadeLinha} role="status">
          <IconUserPlus size={18} aria-hidden />
          <div>
            {n.chegaram_unidade.length > 0 && (
              <p>Chegaram à {n.unidade}: <Pessoas pessoas={n.chegaram_unidade} /></p>
            )}
            {n.chegaram_turma.length > 0 && n.turma && (
              <p>Da sua turma ({TURMAS[n.turma]}): <Pessoas pessoas={n.chegaram_turma} /></p>
            )}
          </div>
          <button type="button" className={styles.novidadeFechar} onClick={fechar} aria-label="Já vi, esconder">
            <IconX size={18} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
