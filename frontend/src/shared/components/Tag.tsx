import { HTMLAttributes } from 'react'
import styles from './Tag.module.css'

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'neutral' | 'success'
  active?: boolean
}

export default function Tag({ variant = 'primary', active = true, className, children, ...props }: TagProps) {
  return (
    <span
      className={[
        styles.tag,
        styles[variant],
        active ? styles.active : styles.inactive,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </span>
  )
}
