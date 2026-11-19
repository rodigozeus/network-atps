import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react'
import { useAuthContext } from './AuthContext'
import { Button, Input } from '@shared/components'
import TelaAcesso from './TelaAcesso'
import styles from './auth.module.css'

const schema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').email('Esse e-mail não parece válido.'),
  senha: z.string().min(1, 'Informe sua senha.'),
})

type LoginForm = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const auth = useAuthContext()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) })

  const aviso = params.has('excluido')
    ? 'Seu perfil e todos os seus dados foram excluídos.'
    : params.has('saiu')
      ? 'Você saiu da sua conta.'
      : null

  const onSubmit = async (data: LoginForm) => {
    try {
      await auth.login(data.email, data.senha)
      navigate('/busca', { replace: true })
    } catch (err: unknown) {
      // 403 = cadastro pendente de aprovação ou conta inativa; a API explica o motivo
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      setError('root', { message: typeof detail === 'string' ? detail : 'E-mail ou senha incorretos.' })
    }
  }

  return (
    <TelaAcesso titulo="Acesse sua conta" subtitulo="A rede dos Analistas Técnicos de Políticas Sociais">
      {aviso && <p className={styles.ok} role="status"><IconCircleCheck size={18} aria-hidden />{aviso}</p>}
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {errors.root && <p className={styles.apiError} role="alert"><IconAlertCircle size={18} aria-hidden />{errors.root.message}</p>}

        <Input label="E-mail" type="email" autoComplete="username" inputMode="email" placeholder="seu@email.com"
          error={errors.email?.message} {...register('email')} />

        <div>
          <Input label="Senha" type="password" autoComplete="current-password"
            error={errors.senha?.message} {...register('senha')} />
          <Link to="/esqueci-senha" className={styles.linkPequeno}>Esqueceu sua senha?</Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>Entrar</Button>
      </form>

      <div className={styles.footer}>
        Ainda não tem conta? <Link to="/registrar">Cadastre-se</Link>
      </div>
      <p className={styles.footer}>
        <Link to="/sobre">Conheça a Rede ATPS</Link>
      </p>
    </TelaAcesso>
  )
}
