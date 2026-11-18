import Andeps from './Andeps'
import { LogoHorizontal } from './Logo'
import styles from './Rodape.module.css'

export default function Rodape({ transparente = false }: { transparente?: boolean }) {
  return (
    <footer className={[styles.rodape, transparente ? styles.transparente : ''].join(' ')}>
      <div className={styles.inner}>
        <div className={styles.marca}>
          <LogoHorizontal className={styles.logo} />
          <span className={styles.divisor} aria-hidden />
          <Andeps altura={16} />
        </div>
        <div className={styles.creditos}>
          <p>
            Criado com carinho por{' '}
            <a href="https://github.com/rodigozeus" target="_blank" rel="noopener noreferrer">rodigozeus</a>
          </p>
          <span className={styles.sep} aria-hidden>·</span>
          <p>
            Design{' '}
            <a href="https://ainvicta.com" target="_blank" rel="noopener noreferrer">Lucivam Queiroz - Invicta Comunicação</a>
          </p>
        </div>
        <small>Todos os direitos reservados © 2026</small>
      </div>
    </footer>
  )
}
