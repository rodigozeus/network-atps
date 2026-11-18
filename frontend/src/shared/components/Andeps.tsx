import type { CSSProperties } from 'react'
import styles from './Andeps.module.css'

/** Assinatura "by Andeps" (logo branca, para fundos laranja) */
export default function Andeps({ className, altura = 24 }: { className?: string; altura?: number }) {
  return (
    <a
      href="https://andeps.org.br/"
      target="_blank"
      rel="noopener noreferrer"
      className={[styles.andeps, className].filter(Boolean).join(' ')}
      style={{ '--h': `${altura}px` } as CSSProperties}
      aria-label="by Andeps (abre o site da Andeps em nova aba)"
    >
      <span className={styles.by} aria-hidden>by</span>
      <img src="/andeps.png" alt="" />
    </a>
  )
}
