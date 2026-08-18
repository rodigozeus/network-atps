import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthContext } from './AuthContext'
import { Button, Input } from '@shared/components'
import styles from './auth.module.css'

const schema = z
  .object({
    nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    email_pessoal: z
      .string()
      .min(1, 'Campo obrigatório')
      .email('E-mail inválido'),
    senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
    confirmar_senha: z.string().min(1, 'Campo obrigatório'),
  })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  })

type RegisterForm = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const auth = useAuthContext()
  const [cadastroPendente, setCadastroPendente] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) })

  const onSubmit = async ({ confirmar_senha: _cs, ...data }: RegisterForm) => {
    void _cs
    try {
      const user = await auth.register(data)
      if (!user.ativo) {
        setCadastroPendente(true)
      } else {
        navigate('/login', { replace: true })
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? (detail as Array<{ msg: string }>).map((e) => e.msg).join('; ')
            : 'Erro ao criar conta. Tente novamente.'
      setError('root', { message: msg })
    }
  }

  if (cadastroPendente) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <p className={styles.brand}>Rede ATPS</p>
            <p className={styles.subtitle}>Cadastro recebido</p>
          </div>
          <div className={styles.pendingNotice}>
            <p>
              <strong>Seu cadastro foi criado, mas está inativo.</strong>
            </p>
            <p>
              Seu nome não foi encontrado na lista de ATPs do portal da
              transparência. Por isso, sua conta foi marcada como{' '}
              <strong>pendente de verificação</strong> e precisará ser aprovada
              manualmente por um administrador.
            </p>
            <p>Você receberá acesso assim que sua conta for ativada.</p>
          </div>
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
          <p className={styles.subtitle}>Crie sua conta</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          {errors.root && <p className={styles.apiError}>{errors.root.message}</p>}

          <Input
            label="Nome completo"
            autoComplete="name"
            error={errors.nome?.message}
            {...register('nome')}
          />

          <div>
            <Input
              label="E-mail pessoal"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              error={errors.email_pessoal?.message}
              {...register('email_pessoal')}
            />
            <p className={styles.notice} style={{ marginTop: 'var(--sp-2)' }}>
              Este e-mail será usado para acesso à plataforma. Ele{' '}
              <strong>não será compartilhado</strong> com outros usuários a menos
              que você autorize na sua página de perfil.
            </p>
          </div>

          <Input
            label="Senha"
            type="password"
            autoComplete="new-password"
            hint="Mínimo de 8 caracteres"
            error={errors.senha?.message}
            {...register('senha')}
          />

          <Input
            label="Confirmar senha"
            type="password"
            autoComplete="new-password"
            error={errors.confirmar_senha?.message}
            {...register('confirmar_senha')}
          />

          <Button type="submit" fullWidth loading={isSubmitting}>
            Criar conta
          </Button>
        </form>

        <div className={styles.footer}>
          Já tem uma conta?{' '}
          <Link to="/login">Entrar</Link>
        </div>
      </div>
    </div>
  )
}
