import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { IconMailCheck } from '@tabler/icons-react'
import { authApi } from '@shared/api/auth'
import { Button, Input } from '@shared/components'
import TelaAcesso from './TelaAcesso'
import styles from './auth.module.css'

const schema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').email('Esse e-mail não parece válido.'),
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
      <TelaAcesso titulo="Verifique seu e-mail">
        <div className={styles.resultado}>
          <span className={styles.resultadoIco}><IconMailCheck size={30} aria-hidden /></span>
          <p>Se o e-mail informado estiver cadastrado, você receberá instruções para redefinir sua senha em instantes.</p>
        </div>
        <div className={styles.footer}><Link to="/login">Voltar para o login</Link></div>
      </TelaAcesso>
    )
  }

  return (
    <TelaAcesso titulo="Esqueci minha senha" subtitulo="Enviaremos um link para você criar uma nova senha.">
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input label="E-mail" type="email" autoComplete="email" placeholder="seu@email.com"
          error={errors.email?.message} {...register('email')} />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>Enviar instruções</Button>
      </form>
      <div className={styles.footer}>Lembrou a senha? <Link to="/login">Entrar</Link></div>
    </TelaAcesso>
  )
}
