import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { IconAlertCircle, IconClockHour4, IconLock, IconShieldCheck, IconUserPlus } from '@tabler/icons-react'
import { useAuthContext } from './AuthContext'
import { Button, Input } from '@shared/components'
import { formatCpf, cpfValido } from '@shared/utils/cpf'
import TelaAcesso from './TelaAcesso'
import styles from './auth.module.css'

const schema = z
  .object({
    nome: z.string().trim().min(3, 'Informe seu nome completo.')
      .refine((v) => v.split(/\s+/).length >= 2, 'Informe nome e sobrenome.'),
    email_pessoal: z.string().min(1, 'Informe seu e-mail pessoal.').email('Esse e-mail não parece válido.'),
    cpf: z.string().min(1, 'Informe seu CPF.').refine(cpfValido, 'Esse CPF não é válido. Confira os números.'),
    senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
    confirmar_senha: z.string().min(1, 'Repita a senha.'),
    aceite_termos: z.boolean().refine((v) => v === true, {
      message: 'Para criar a conta, é preciso concordar com o Termo de Consentimento.',
    }),
  })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: 'As senhas não são iguais.',
    path: ['confirmar_senha'],
  })

type RegisterForm = z.infer<typeof schema>

const TERMO_LGPD = `A Rede ATPS é uma plataforma voltada à conexão profissional entre Analistas Técnicos de Políticas Sociais (ATPS) do Poder Executivo Federal. Ao criar sua conta, você concorda com o tratamento dos seus dados pessoais nos termos abaixo, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).

1. Quais dados coletamos e por quê
— Nome, e-mail pessoal e senha: necessários para criar e proteger sua conta.
— CPF: utilizado uma única vez, no momento do cadastro, exclusivamente para consultar a base pública de servidores do Portal da Transparência do Governo Federal e confirmar seu vínculo como ATPS. Após essa consulta, o CPF é criptografado e o número original é descartado — nem mesmo os administradores da plataforma têm acesso ao seu CPF.
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
Sua senha e seu CPF são armazenados de forma criptografada, nunca em texto puro. Os dados ficam em banco de dados protegido, acessível apenas pela equipe técnica responsável pela operação da plataforma.

Ao marcar a caixa abaixo, você declara que leu e concorda com este Termo de Consentimento, incluindo a consulta do seu CPF ao Portal da Transparência para fins de verificação do vínculo funcional, nos termos aqui descritos.`

/** Termo em blocos: "1. Título" vira subtítulo; o resto, parágrafos */
function Termo() {
  return (
    <>
      {TERMO_LGPD.split('\n').filter((l) => l.trim()).map((linha, i) =>
        /^\d+\. /.test(linha) ? <h3 key={i}>{linha}</h3> : <p key={i}>{linha}</p>)}
    </>
  )
}

// Força da senha: só orientação, o mínimo exigido continua sendo 8 caracteres
function forca(s: string): number {
  if (!s) return 0
  let n = s.length >= 8 ? 1 : 0
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) n++
  if (/\d/.test(s)) n++
  if (/[^A-Za-z0-9]/.test(s) || s.length >= 14) n++
  return Math.max(1, Math.min(4, n))
}

export default function RegisterPage() {
  const auth = useAuthContext()
  const navigate = useNavigate()
  const [resultado, setResultado] = useState<'pendente' | 'confirmado' | null>(null)
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', email_pessoal: '', cpf: '', senha: '', confirmar_senha: '', aceite_termos: false },
  })

  const onSubmit = async ({ confirmar_senha: _cs, ...data }: RegisterForm) => {
    void _cs
    try {
      // A API consulta o CPF no Portal da Transparência: encontrado como ATPS = conta ativa;
      // não encontrado (ou portal fora do ar) = cadastro pendente de aprovação manual.
      const user = await auth.register({ ...data, nome: data.nome.trim().replace(/\s+/g, ' ') })
      if (!user.ativo) {
        setResultado('pendente')
        return
      }
      try {
        await auth.login(data.email_pessoal, data.senha)
        navigate('/perfil', { replace: true, state: { bemVindo: true } })
      } catch {
        setResultado('confirmado') // conta ativa, mas o login automático falhou: entra pela tela de login
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? (detail as Array<{ msg: string }>).map((e) => e.msg).join('; ')
            : 'Não foi possível criar a conta. Tente de novo.'
      setError('root', { message: msg })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (resultado === 'pendente') {
    return (
      <TelaAcesso titulo="Cadastro em análise">
        <div className={styles.resultado}>
          <span className={styles.resultadoIco}><IconClockHour4 size={30} aria-hidden /></span>
          <p><strong>Seu cadastro foi recebido, mas ainda não está ativo.</strong></p>
          <p>
            Não conseguimos confirmar automaticamente seu vínculo como ATPS no Portal da Transparência
            do Governo Federal. Uma pessoa da administração vai analisar o cadastro e você receberá um
            e-mail assim que a conta for liberada.
          </p>
        </div>
        <div className={styles.footer}><Link to="/login">Voltar para o login</Link></div>
      </TelaAcesso>
    )
  }

  if (resultado === 'confirmado') {
    return (
      <TelaAcesso titulo="Cadastro confirmado">
        <div className={styles.resultado}>
          <p><strong>Seu vínculo como ATPS foi confirmado</strong> no Portal da Transparência. Sua conta já está ativa.</p>
        </div>
        <div className={styles.footer}><Link to="/login">Entrar e completar meu perfil</Link></div>
      </TelaAcesso>
    )
  }

  return (
    <TelaAcesso titulo="Crie sua conta" subtitulo="Depois de criar a conta, você preenche seu perfil." largo>
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {errors.root && <p className={styles.apiError} role="alert"><IconAlertCircle size={18} aria-hidden />{errors.root.message}</p>}

        <Input label="Nome completo" autoComplete="name" error={errors.nome?.message} {...register('nome')} />

        <div>
          <Input label="E-mail pessoal" type="email" autoComplete="email" inputMode="email" placeholder="seu@email.com"
            error={errors.email_pessoal?.message} aria-describedby="info-email" {...register('email_pessoal')} />
          <p className={styles.info} id="info-email">
            <IconLock size={18} aria-hidden />
            <span>Este e-mail será usado para acesso à plataforma. Ele <strong>não será compartilhado</strong> com outros usuários, a menos que você autorize na sua página de perfil.</span>
          </p>
        </div>

        <div>
          <Controller control={control} name="cpf" render={({ field }) => (
            <Input label="CPF" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
              error={errors.cpf?.message} aria-describedby="info-cpf" {...field}
              onChange={(e) => field.onChange(formatCpf(e.target.value))} />
          )} />
          <p className={styles.info} id="info-cpf">
            <IconShieldCheck size={18} aria-hidden />
            <span>Usado apenas uma vez para confirmar seu vínculo como ATPS junto ao Portal da Transparência. Em seguida é criptografado e o número original é descartado — não é armazenado nem fica acessível a ninguém.</span>
          </p>
        </div>

        <Input label="Senha" type="password" autoComplete="new-password"
          hint="Mínimo de 8 caracteres. Misture letras, números e símbolos para uma senha mais forte."
          error={errors.senha?.message} {...register('senha')} />
        <div className={styles.forca} data-n={forca(watch('senha') ?? '')} aria-hidden>
          <span /><span /><span /><span />
        </div>

        <Input label="Confirmar senha" type="password" autoComplete="new-password"
          error={errors.confirmar_senha?.message} {...register('confirmar_senha')} />

        <div>
          <h2 className={styles.termosLabel} id="termo-titulo">Termo de Consentimento — Tratamento de Dados (LGPD)</h2>
          <div className={styles.termosBox} tabIndex={0} role="region" aria-labelledby="termo-titulo">
            <Termo />
          </div>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" aria-invalid={errors.aceite_termos ? true : undefined} {...register('aceite_termos')} />
            Li e concordo com o Termo de Consentimento acima, incluindo a consulta do meu CPF ao Portal da Transparência.
          </label>
          {errors.aceite_termos && <p className={styles.error} role="alert">{errors.aceite_termos.message}</p>}
        </div>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          <IconUserPlus size={18} aria-hidden />Criar conta
        </Button>
      </form>

      <div className={styles.footer}>Já tem uma conta? <Link to="/login">Entrar</Link></div>
    </TelaAcesso>
  )
}
