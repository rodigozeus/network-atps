import { HTMLAttributes } from 'react'
import styles from './Card.module.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export default function Card({ padding = 'md', className, children, ...props }: CardProps) {
  return (
    <div
      className={[styles.card, styles[`p-${padding}`], className ?? ''].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}
