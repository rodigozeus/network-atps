import styles from './Spinner.module.css'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'current' | 'white'
}

export default function Spinner({ size = 'md', color = 'primary' }: SpinnerProps) {
  return (
    <span
      className={[styles.spinner, styles[size], styles[color]].join(' ')}
      role="status"
      aria-label="Carregando"
    />
  )
}
