import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthContext } from './AuthContext'
import { Button, Input } from '@shared/components'
import { formatCpf, cpfValido } from '@shared/utils/cpf'
import styles from './auth.module.css'

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
  })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  })

type RegisterForm = z.infer<typeof schema>

const TERMO_LGPD = `A Rede ATPS é uma plataforma voltada à conexão profissional entre Analistas Técnicos de Políticas Sociais (ATPS) do Poder Executivo Federal. Ao criar sua conta, você concorda com o tratamento dos seus dados pessoais nos termos abaixo, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).

1. Quais dados coletamos e por quê
— Nome, e-mail pessoal e senha: necessários para criar e proteger sua conta.
— CPF: utilizado uma única vez, no momento do cadastro, exclusivamente para consultar a base pública de servidores do Portal da Transparência do Governo Federal e confirmar seu vínculo como ATPS. Após essa consulta, o CPF é convertido em um código criptográfico irreversível (hash) e o número original é descartado — nem mesmo os administradores da plataforma têm acesso ao seu CPF.
— Dados profissionais complementares (e-mail institucional, celular, órgão de lotação, cargo, formação acadêmica, temas de atuação, foto): fornecidos por você, de forma opcional, para compor seu perfil profissional.

2. Finalidade do tratamento
Seus dados são usados exclusivamente para viabilizar o funcionamento da Rede ATPS: autenticação, exibição do seu perfil profissional a outros(as) analistas cadastrados(as) e busca por colegas com formação ou temas de atuação em comum.

3. Compartilhamento
Seus dados de contato (e-mail pessoal e celular) só são exibidos a outros usuários se você optar, explicitamente e a qualquer momento, por torná-los visíveis nas configurações do seu perfil. Os demais dados de perfil (nome, órgão, formação, temas de atuação) são visíveis a outros(as) analistas autenticados(as) na plataforma, pois essa é a finalidade da rede. Não compartilhamos seus dados com terceiros para fins comerciais ou publicitários.

4. Base legal
O tratamento se baseia no seu consentimento (art. 7º, I, LGPD), livremente concedido neste cadastro, e no legítimo interesse da associação profissional em manter um diretório verificado de seus membros (art. 7º, IX).

5. Seus direitos
Você pode, a qualquer momento: acessar e corrigir seus dados na página "Meu Perfil"; revogar a visibilidade do e-mail pessoal e do celular; e excluir permanentemente sua conta e todos os seus dados, de forma irreversível, na opção "Excluir minha conta" do seu perfil.

6. Armazenamento e segurança
Sua senha e seu CPF são armazenados apenas na forma de hash (criptografia unidirecional), nunca em texto puro. Os dados ficam em banco de dados protegido, acessível apenas pela equipe técnica responsável pela operação da plataforma.

Ao marcar a caixa abaixo, você declara que leu e concorda com este Termo de Consentimento, incluindo a consulta do seu CPF ao Portal da Transparência para fins de verificação do vínculo funcional, nos termos aqui descritos.`

export default function RegisterPage() {
  const auth = useAuthContext()
  const [cadastroPendente, setCadastroPendente] = useState(false)
  const [cadastroConfirmado, setCadastroConfirmado] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: { aceite_termos: false },
  })

  const onSubmit = async ({ confirmar_senha: _cs, ...data }: RegisterForm) => {
    void _cs
    try {
      const user = await auth.register(data)
      if (!user.ativo) {
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
              Não conseguimos confirmar automaticamente seu vínculo como ATPS
              junto ao Portal da Transparência do Governo Federal. Por isso,
              sua conta foi marcada como{' '}
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
              Usado apenas uma vez para confirmar seu vínculo como ATPS junto ao
              Portal da Transparência. Em seguida é convertido em hash e o número
              original é descartado — não é armazenado nem fica acessível a ninguém.
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

          <div>
            <p className={styles.termosLabel}>Termo de Consentimento — Tratamento de Dados (LGPD)</p>
            <div className={styles.termosBox} tabIndex={0}>
              {TERMO_LGPD}
            </div>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" {...register('aceite_termos')} />
              Li e concordo com o Termo de Consentimento acima, incluindo a consulta
              do meu CPF ao Portal da Transparência.
            </label>
            {errors.aceite_termos && (
              <p className={styles.error}>{errors.aceite_termos.message}</p>
            )}
          </div>

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
