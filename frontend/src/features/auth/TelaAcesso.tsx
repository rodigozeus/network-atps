import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogoHorizontal, Rodape } from '@shared/components'
import styles from './auth.module.css'

/** Moldura das telas de acesso: fundo laranja da marca, logo em branco e um cartão central */
export default function TelaAcesso({ titulo, subtitulo, largo, children }: {
  titulo: string
  subtitulo?: string
  largo?: boolean
  children: ReactNode
}) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link to="/login" className={styles.logo} aria-label="Rede ATPS, ir para o login">
          <LogoHorizontal />
        </Link>
        <section className={[styles.card, largo ? styles.largo : ''].join(' ')} aria-labelledby="titulo-acesso">
          <h1 id="titulo-acesso" className={styles.titulo}>{titulo}</h1>
          {subtitulo && <p className={styles.subtitle}>{subtitulo}</p>}
          {children}
        </section>
      </main>
      <Rodape transparente />
    </div>
  )
}
