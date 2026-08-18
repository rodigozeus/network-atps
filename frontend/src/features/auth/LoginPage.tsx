import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthContext } from './AuthContext'
import { Button, Input } from '@shared/components'
import styles from './auth.module.css'

const schema = z.object({
  email: z.string().min(1, 'Campo obrigatório').email('E-mail inválido'),
  senha: z.string().min(1, 'Campo obrigatório'),
})

type LoginForm = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const auth = useAuthContext()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: LoginForm) => {
    try {
      await auth.login(data.email, data.senha)
      navigate('/busca', { replace: true })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : 'Credenciais inválidas'
      setError('root', { message: msg })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <p className={styles.brand}>Rede ATPS</p>
          <p className={styles.subtitle}>Acesse sua conta</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          {errors.root && <p className={styles.apiError}>{errors.root.message}</p>}

          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <div>
            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              error={errors.senha?.message}
              {...register('senha')}
            />
            <p style={{ marginTop: 'var(--sp-2)', textAlign: 'right', fontSize: 'var(--font-xs)' }}>
              <Link to="/esqueci-senha">Esqueceu sua senha?</Link>
            </p>
          </div>

          <Button type="submit" fullWidth loading={isSubmitting}>
            Entrar
          </Button>
        </form>

        <div className={styles.footer}>
          Ainda não tem conta?{' '}
          <Link to="/registrar">Cadastre-se</Link>
        </div>
      </div>
    </div>
  )
}
