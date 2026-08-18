import { HTMLAttributes } from 'react'
import styles from './Badge.module.css'

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'admin'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export default function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={[styles.badge, styles[variant], className ?? ''].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </span>
  )
}
