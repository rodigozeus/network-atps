import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authApi } from '@shared/api/auth'
import { Button, Input } from '@shared/components'
import styles from './auth.module.css'

const schema = z.object({
  email: z.string().min(1, 'Campo obrigatório').email('E-mail inválido'),
})

type ForgotPasswordForm = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [enviado, setEnviado] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: ForgotPasswordForm) => {
    // Sempre mostra a mesma mensagem, exista ou não o e-mail — evita
    // revelar quais e-mails estão cadastrados.
    await authApi.forgotPassword(data.email).catch(() => undefined)
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <p className={styles.brand}>Rede ATPS</p>
            <p className={styles.subtitle}>Verifique seu e-mail</p>
          </div>
          <p className={styles.notice}>
            Se o e-mail informado estiver cadastrado, você receberá instruções para
            redefinir sua senha em instantes.
          </p>
          <div className={styles.footer}>
            <Link to="/login">Voltar para o login</Link>
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
          <p className={styles.subtitle}>Esqueci minha senha</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Button type="submit" fullWidth loading={isSubmitting}>
            Enviar instruções
          </Button>
        </form>

        <div className={styles.footer}>
          Lembrou a senha? <Link to="/login">Entrar</Link>
        </div>
      </div>
    </div>
  )
}
