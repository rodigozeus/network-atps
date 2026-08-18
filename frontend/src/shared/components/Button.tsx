import { ButtonHTMLAttributes, forwardRef } from 'react'
import Spinner from './Spinner'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading, fullWidth, children, disabled, className, ...props },
    ref,
  ) => {
    const cls = [
      styles.btn,
      styles[variant],
      styles[size],
      fullWidth ? styles.fullWidth : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button ref={ref} className={cls} disabled={disabled || loading} {...props}>
        {loading && <Spinner size="sm" color={variant === 'outline' || variant === 'ghost' ? 'primary' : 'white'} />}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
export default Button
