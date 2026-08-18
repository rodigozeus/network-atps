import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authApi } from '@shared/api/auth'
import { Button, Input } from '@shared/components'
import styles from './auth.module.css'

const schema = z
  .object({
    senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
    confirmar_senha: z.string().min(1, 'Campo obrigatório'),
  })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  })

type ResetPasswordForm = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [concluido, setConcluido] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(schema) })

  const onSubmit = async ({ senha }: ResetPasswordForm) => {
    try {
      await authApi.resetPassword(token, senha)
      setConcluido(true)
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : 'Erro ao redefinir senha. Tente novamente.'
      setError('root', { message: msg })
    }
  }

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <p className={styles.brand}>Rede ATPS</p>
            <p className={styles.subtitle}>Link inválido</p>
          </div>
          <p className={styles.apiError}>
            Este link de redefinição de senha é inválido. Solicite um novo.
          </p>
          <div className={styles.footer}>
            <Link to="/esqueci-senha">Solicitar redefinição de senha</Link>
          </div>
        </div>
      </div>
    )
  }

  if (concluido) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <p className={styles.brand}>Rede ATPS</p>
            <p className={styles.subtitle}>Senha redefinida</p>
          </div>
          <p className={styles.notice}>
            Sua senha foi redefinida com sucesso. Você será redirecionado para o login.
          </p>
          <div className={styles.footer}>
            <Link to="/login">Ir para o login</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <p className={styles.brand}>Rede ATPS</p>
          <p className={styles.subtitle}>Escolha uma nova senha</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          {errors.root && <p className={styles.apiError}>{errors.root.message}</p>}

          <Input
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            hint="Mínimo de 8 caracteres"
            error={errors.senha?.message}
            {...register('senha')}
          />

          <Input
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            error={errors.confirmar_senha?.message}
            {...register('confirmar_senha')}
          />

          <Button type="submit" fullWidth loading={isSubmitting}>
            Redefinir senha
          </Button>
        </form>

        <div className={styles.footer}>
          <Link to="/login">Voltar para o login</Link>
        </div>
      </div>
    </div>
  )
}
