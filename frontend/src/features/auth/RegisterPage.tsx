import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthContext } from './AuthContext'
import { Button, Input } from '@shared/components'
import { formatCpf, cpfValido } from '@shared/utils/cpf'
import styles from './auth.module.css'
import {
  AUTORIZACAO_CONSULTA_CPF, DocumentoBox, TERMO_CONSENTIMENTO, useDocumentosAtuais,
} from './DocumentosLegais'

const schema = z
  .object({
    nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    email_pessoal: z
      .string()
      .min(1, 'Campo obrigatório')
      .email('E-mail inválido'),
    cpf: z.string().refine(cpfValido, 'CPF inválido'),
    senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
    confirmar_senha: z.string().min(1, 'Campo obrigatório'),
    aceite_termos: z.boolean().refine((v) => v === true, {
      message: 'É necessário ler e concordar com o Termo de Consentimento para continuar',
    }),
    aceite_consulta_cpf: z.boolean().refine((v) => v === true, {
      message: 'É necessário autorizar a consulta do CPF para confirmar seu vínculo',
    }),
  })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  })

type RegisterForm = z.infer<typeof schema>

export default function RegisterPage() {
  const auth = useAuthContext()
  const { documentos, versoes, carregado, erro: erroDocumentos } = useDocumentosAtuais()
  const [cadastroPendente, setCadastroPendente] = useState(false)
  const [motivoPendencia, setMotivoPendencia] = useState<string | null>(null)
  const [cadastroConfirmado, setCadastroConfirmado] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: { aceite_termos: false, aceite_consulta_cpf: false },
  })

  const onSubmit = async ({ confirmar_senha: _cs, ...data }: RegisterForm) => {
    void _cs
    try {
      const resultado = await auth.register({ ...data, versoes })
      if (!resultado.ativo) {
        setMotivoPendencia(resultado.motivo)
        setCadastroPendente(true)
      } else {
        setCadastroConfirmado(true)
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

  if (cadastroConfirmado) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <p className={styles.brand}>Rede ATPS</p>
            <p className={styles.subtitle}>Cadastro confirmado</p>
          </div>
          <div className={styles.confirmedNotice}>
            <p>
              <strong>Seu vínculo como ATPS foi confirmado</strong> junto ao Portal da
              Transparência do Governo Federal.
            </p>
            <p>Sua conta já está ativa — você já pode fazer login.</p>
          </div>
          <div className={styles.footer}>
            <Link to="/login">Ir para o login</Link>
          </div>
        </div>
      </div>
    )
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
              {motivoPendencia ??
                'Não foi possível concluir a verificação automática do seu vínculo como ATPS.'}
            </p>
            <p>
              Por isso, sua conta foi marcada como{' '}
              <strong>pendente de verificação</strong> e será analisada
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

          <div>
            <Controller
              control={control}
              name="cpf"
              render={({ field }) => (
                <Input
                  label="CPF"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  error={errors.cpf?.message}
                  {...field}
                  onChange={(e) => field.onChange(formatCpf(e.target.value))}
                />
              )}
            />
            <p className={styles.notice} style={{ marginTop: 'var(--sp-2)' }}>
              Usado para confirmar seu vínculo como ATPS no Portal da Transparência,
              no cadastro e periodicamente. Fica guardado criptografado e não é
              exibido a nenhum usuário.
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

          {erroDocumentos && (
            <p className={styles.apiError}>
              Não foi possível carregar os termos. Recarregue a página para continuar.
            </p>
          )}

          <div>
            <DocumentoBox doc={documentos[TERMO_CONSENTIMENTO]} />
            <label className={styles.checkboxLabel}>
              <input type="checkbox" {...register('aceite_termos')} />
              Li e concordo com o Termo de Consentimento acima.
            </label>
            {errors.aceite_termos && (
              <p className={styles.error}>{errors.aceite_termos.message}</p>
            )}
          </div>

          <div>
            <DocumentoBox doc={documentos[AUTORIZACAO_CONSULTA_CPF]} />
            <label className={styles.checkboxLabel}>
              <input type="checkbox" {...register('aceite_consulta_cpf')} />
              Autorizo a consulta do meu CPF ao Portal da Transparência, nos termos acima.
            </label>
            {errors.aceite_consulta_cpf && (
              <p className={styles.error}>{errors.aceite_consulta_cpf.message}</p>
            )}
          </div>

          <Button type="submit" fullWidth loading={isSubmitting} disabled={!carregado}>
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
