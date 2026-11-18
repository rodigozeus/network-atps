import { forwardRef, useEffect, useMemo, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { IconCheck, IconPhotoUp, IconTrash } from '@tabler/icons-react'
import type { AnalistaOut, AnalistaUpdate, Turma } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import { semEndpoint } from '@shared/api/semEndpoint'
import { Avatar, Spinner } from '@shared/components'
import { useAuth } from '@shared/hooks/useAuth'
import { formatPhone } from '@shared/utils/phone'
import { TURMAS, estiloPaleta, iniciais } from '@shared/utils/analista'
import CamposLotacao, { NIVEIS_LOTACAO, type LotacaoValor } from './CamposLotacao'
import EditorTemas from './EditorTemas'
import EditorFormacoes from './EditorFormacoes'
import styles from './perfil.module.css'

const telefone = z.string().refine((v) => !v || /^\(\d{2}\) \d{4,5}-\d{4}$/.test(v), 'Informe o DDD e o número completo.')
const emailOpcional = z.string().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Esse e-mail não parece válido.')

const linkOpcional = z.string().refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), 'Cole o endereço completo, começando com https://')

const schema = z.object({
  nome: z.string().trim().min(3, 'Informe seu nome completo.'),
  email_pessoal: z.string().trim().min(1, 'Informe seu e-mail pessoal.').email('Esse e-mail não parece válido.'),
  visibilidade_email_pessoal: z.boolean(),
  telefone_institucional: telefone,
  email_institucional: emailOpcional,
  celular: telefone,
  visibilidade_celular: z.boolean(),
  cargo_fce: z.string(),
  portal_url: linkOpcional,
  linkedin_url: linkOpcional,
  lattes_url: linkOpcional,
  turma: z.string(),
})
type Form = z.infer<typeof schema>

type Aba = 'dados' | 'formacao'

const lotacaoDe = (p: AnalistaOut): LotacaoValor => ({
  ministerio: { nome: p.ministerio ?? '', sigla: p.ministerio_sigla ?? '', novo: false },
  secretaria: { nome: p.secretaria ?? '', sigla: p.secretaria_sigla ?? '', novo: false },
  departamento: { nome: p.departamento ?? '', sigla: p.departamento_sigla ?? '', novo: false },
  coordenacao_geral: { nome: p.coordenacao_geral ?? '', sigla: '', novo: false },
  coordenacao: { nome: p.coordenacao ?? '', sigla: '', novo: false },
})

const nulo = (v: string) => (v.trim() ? v.trim() : null)

/** Edição do próprio perfil (rota /perfil). Sem ministério informado, vira "Complete seu perfil". */
export default function ProfilePage() {
  const { atualizarUsuario } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [perfil, setPerfil] = useState<AnalistaOut | null>(null)
  const [aba, setAba] = useState<Aba>('dados')

  useEffect(() => {
    perfilApi.getMe().then(setPerfil).catch(() => setPerfil(null))
  }, [])

  if (!perfil) return <div className={styles.carregando}><Spinner size="lg" /></div>

  const primeiroAcesso = !perfil.ministerio || (location.state as { bemVindo?: boolean } | null)?.bemVindo === true

  return (
    <div className={styles.editar}>
      <div className={styles.editarTopo}>
        <h1>{primeiroAcesso ? 'Complete seu perfil' : 'Editar perfil'}</h1>
        <p>
          {primeiroAcesso
            ? 'Boas-vindas à Rede ATPS! Conte onde você trabalha e com o que atua para que colegas encontrem você. Só o nome, o e-mail e o ministério são obrigatórios.'
            : 'O que você preencher aparece no seu perfil público, exceto onde estiver indicado.'}
        </p>
      </div>

      <div className={styles.abas} role="tablist" aria-label="Seções do perfil">
        {([['dados', 'Dados do perfil'], ['formacao', 'Formação e temas']] as const).map(([id, rotulo]) => (
          <button key={id} type="button" role="tab" id={`aba-${id}`} aria-controls={`painel-${id}`}
            aria-selected={aba === id} tabIndex={aba === id ? 0 : -1} className={styles.aba}
            onClick={() => setAba(id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault()
                const outra: Aba = aba === 'dados' ? 'formacao' : 'dados'
                setAba(outra)
                document.getElementById(`aba-${outra}`)?.focus()
              }
            }}>
            {rotulo}
          </button>
        ))}
      </div>

      <div id="painel-dados" role="tabpanel" aria-labelledby="aba-dados" hidden={aba !== 'dados'}>
        <DadosPerfil perfil={perfil} primeiroAcesso={primeiroAcesso}
          onSalvo={(p) => {
            setPerfil(p)
            atualizarUsuario(p)
            navigate(`/analistas/${p.id}?salvo=1`)
          }}
          onCancelar={() => navigate(primeiroAcesso ? '/busca' : `/analistas/${perfil.id}`)} />
      </div>

      <div id="painel-formacao" role="tabpanel" aria-labelledby="aba-formacao" hidden={aba !== 'formacao'} className={styles.painel}>
        <section className={styles.secao}>
          <h2>Temas de atuação<small>Ajudam colegas a encontrar você pela busca e pelos filtros. Cada alteração é salva na hora.</small></h2>
          <EditorTemas temas={perfil.temas} onChange={(temas) => { const p = { ...perfil, temas }; setPerfil(p); atualizarUsuario(p) }} />
        </section>
        <section className={styles.secao}>
          <h2>Formação acadêmica<small>Cada alteração é salva na hora.</small></h2>
          <EditorFormacoes formacoes={perfil.formacoes} onChange={(formacoes) => { const p = { ...perfil, formacoes }; setPerfil(p); atualizarUsuario(p) }} />
        </section>
        <div className={styles.salvarBarra}>
          <Link className={[styles.botao, styles.primario].join(' ')} to={`/analistas/${perfil.id}`}>Ver meu perfil</Link>
        </div>
      </div>
    </div>
  )
}

function DadosPerfil({ perfil, primeiroAcesso, onSalvo, onCancelar }: {
  perfil: AnalistaOut
  primeiroAcesso: boolean
  onSalvo: (p: AnalistaOut) => void
  onCancelar: () => void
}) {
  const { register, control, handleSubmit, formState: { errors, isDirty, isSubmitting }, setFocus } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: perfil.nome,
      email_pessoal: perfil.email_pessoal,
      visibilidade_email_pessoal: perfil.visibilidade_email_pessoal,
      telefone_institucional: formatPhone(perfil.telefone_institucional ?? ''),
      email_institucional: perfil.email_institucional ?? '',
      celular: formatPhone(perfil.celular ?? ''),
      visibilidade_celular: perfil.visibilidade_celular,
      cargo_fce: perfil.cargo_fce ?? '',
      portal_url: perfil.portal_url ?? '',
      linkedin_url: perfil.linkedin_url ?? '',
      lattes_url: perfil.lattes_url ?? '',
      turma: perfil.turma ?? '',
    },
  })

  const lotacaoInicial = useMemo(() => lotacaoDe(perfil), [perfil])
  const [lotacao, setLotacao] = useState<LotacaoValor>(lotacaoInicial)
  const [errosLotacao, setErrosLotacao] = useState<Record<string, string>>({})
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoRemovida, setFotoRemovida] = useState(false)
  const [erroFoto, setErroFoto] = useState('')
  const [status, setStatus] = useState<{ texto: string; erro?: boolean } | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const salvo = useRef(false)

  const lotacaoMudou = JSON.stringify(lotacao) !== JSON.stringify(lotacaoInicial)
  const alterado = isDirty || lotacaoMudou || !!foto || fotoRemovida

  // Aviso ao fechar ou recarregar a aba com alterações não salvas
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => { if (alterado && !salvo.current) e.preventDefault() }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [alterado])

  useEffect(() => () => { if (fotoPreview) URL.revokeObjectURL(fotoPreview) }, [fotoPreview])

  const escolherFoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    setErroFoto('')
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { setErroFoto('Escolha uma imagem JPG, PNG ou WEBP.'); return }
    if (f.size > 10 * 1024 * 1024) { setErroFoto('A imagem passa de 10 MB. Escolha uma menor.'); return }
    setFoto(f)
    setFotoRemovida(false)
    setFotoPreview(URL.createObjectURL(f))
  }

  const validarLotacao = (): boolean => {
    const erros: Record<string, string> = {}
    const m = lotacao.ministerio
    if (!m.nome.trim()) erros.ministerio = 'Informe o ministério em que você está em exercício.'
    NIVEIS_LOTACAO.forEach((n) => {
      const v = lotacao[n.id]
      if (v.novo && !v.nome.trim() && !erros[n.id]) erros[n.id] = `${n.nomeNovo}: preencha o campo.`
      if (v.novo && n.sigla && v.nome.trim() && !v.sigla.trim()) erros[`${n.id}_sigla`] = 'Informe a sigla.'
    })
    setErrosLotacao(erros)
    return !Object.keys(erros).length
  }

  const salvar = async (d: Form) => {
    if (!validarLotacao()) {
      setStatus({ texto: 'Corrija os campos do órgão de exercício para salvar.', erro: true })
      document.getElementById('lot-ministerio')?.focus()
      return
    }
    setStatus(null)
    // Caminho até o primeiro nível vazio; campos vazios vão como null para poderem ser apagados
    const niveis: Partial<Record<string, string | null>> = {}
    let parou = false
    NIVEIS_LOTACAO.forEach((n) => {
      const v = lotacao[n.id]
      const nome = parou ? '' : v.nome.trim()
      if (!nome) parou = true
      niveis[n.id] = nulo(nome)
      if (n.sigla) niveis[`${n.id}_sigla`] = nome ? nulo(v.sigla) : null
    })
    const corpo: AnalistaUpdate = {
      nome: d.nome.trim().replace(/\s+/g, ' '),
      email_pessoal: d.email_pessoal.trim(),
      visibilidade_email_pessoal: d.visibilidade_email_pessoal,
      visibilidade_celular: d.visibilidade_celular,
      turma: (d.turma || null) as Turma,
      ...(niveis as AnalistaUpdate),
      telefone_institucional: nulo(d.telefone_institucional) as string,
      email_institucional: nulo(d.email_institucional) as string,
      celular: nulo(d.celular) as string,
      cargo_fce: nulo(d.cargo_fce) as string,
      portal_url: nulo(d.portal_url) as string,
      linkedin_url: nulo(d.linkedin_url) as string,
      lattes_url: nulo(d.lattes_url) as string,
    }
    try {
      let atualizado = await perfilApi.updateMe(corpo)
      if (foto) atualizado = await perfilApi.uploadFoto(foto)
      else if (fotoRemovida && perfil.foto_path) {
        try {
          atualizado = await perfilApi.deleteFoto()
        } catch (err) {
          if (!semEndpoint(err)) throw err
          setStatus({ texto: 'Dados salvos, mas remover a foto ainda não está disponível.', erro: true })
          return
        }
      }
      salvo.current = true
      onSalvo(atualizado)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
      setStatus({ texto: typeof detail === 'string' ? detail : 'Não foi possível salvar. Tente de novo.', erro: true })
    }
  }

  const fotoAtual = fotoRemovida ? null : perfil.foto_path
  const qtdErros = Object.keys(errors).length

  return (
    <form className={styles.painel} noValidate
      onSubmit={handleSubmit(salvar, (e) => {
        validarLotacao()
        const n = Object.keys(e).length
        setStatus({ texto: n === 1 ? 'Corrija o campo destacado para salvar.' : `Corrija os ${n} campos destacados para salvar.`, erro: true })
        const primeiro = Object.keys(e)[0] as keyof Form
        if (primeiro) setFocus(primeiro)
      })}>
      <section className={styles.secao}>
        <h2>Foto de perfil</h2>
        <div className={styles.fotoLinha}>
          {fotoPreview ? (
            <span className={styles.fotoPreview} style={estiloPaleta(perfil.id)}><img src={fotoPreview} alt="Sua nova foto de perfil" /></span>
          ) : fotoAtual ? (
            <Avatar id={perfil.id} nome={perfil.nome} fotoPath={fotoAtual} tamanho={104} className={styles.fotoPreview} alt="Sua foto de perfil" />
          ) : (
            <span className={styles.fotoPreview} style={estiloPaleta(perfil.id)}>{iniciais(perfil.nome)}</span>
          )}
          <div className={styles.fotoBotoes}>
            <button type="button" className={[styles.botao, styles.secundario].join(' ')} onClick={() => arquivo.current?.click()}>
              <IconPhotoUp size={18} aria-hidden />Escolher imagem
            </button>
            <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={escolherFoto} />
            {(fotoPreview || fotoAtual) && (
              <button type="button" className={[styles.botao, styles.leve].join(' ')} onClick={() => {
                setFoto(null)
                setFotoPreview(null)
                setFotoRemovida(!!perfil.foto_path)
              }}>
                <IconTrash size={18} aria-hidden />Remover foto
              </button>
            )}
          </div>
          <p className={styles.ajuda}>JPG, PNG ou WEBP, até 10 MB. A foto é enviada quando você salva.</p>
          {erroFoto && <p className={styles.erro} role="alert">{erroFoto}</p>}
        </div>
      </section>

      <section className={styles.secao}>
        <h2>Dados básicos</h2>
        <div className={styles.campos}>
          <Campo id="nome" rotulo="Nome completo" obrigatorio erro={errors.nome?.message}>
            <input id="nome" autoComplete="name" {...register('nome')} aria-invalid={!!errors.nome} />
          </Campo>
          <Campo id="email_pessoal" rotulo="E-mail pessoal" obrigatorio erro={errors.email_pessoal?.message}
            ajuda="Usado para acesso — não é compartilhado sem sua autorização.">
            <input id="email_pessoal" type="email" autoComplete="email" {...register('email_pessoal')} aria-invalid={!!errors.email_pessoal} />
          </Campo>
          <Chave rotulo="Mostrar e-mail pessoal no perfil público" {...register('visibilidade_email_pessoal')} />
        </div>
      </section>

      <section className={styles.secao}>
        <h2>Órgão de exercício<small>As siglas aparecem nos cards da busca; os nomes completos, no seu perfil.</small></h2>
        <CamposLotacao valor={lotacao} erros={errosLotacao} onChange={(v) => { setLotacao(v); setErrosLotacao({}) }} />
        <p className={styles.ajuda}>Não encontrou o seu na lista? Escolha a opção “+ Adicionar” no fim dela.</p>
      </section>

      <section className={styles.secao}>
        <h2>Contato</h2>
        <div className={styles.campos}>
          <Controller control={control} name="telefone_institucional" render={({ field }) => (
            <Campo id="telefone_institucional" rotulo="Telefone institucional" erro={errors.telefone_institucional?.message}>
              <input id="telefone_institucional" type="tel" inputMode="tel" placeholder="(61) 2020-0000" {...field}
                aria-invalid={!!errors.telefone_institucional} onChange={(e) => field.onChange(formatPhone(e.target.value))} />
            </Campo>
          )} />
          <Campo id="email_institucional" rotulo="E-mail institucional" erro={errors.email_institucional?.message}
            ajuda="Aparece no seu perfil público quando preenchido.">
            <input id="email_institucional" type="email" placeholder="nome.sobrenome@orgao.gov.br" {...register('email_institucional')} aria-invalid={!!errors.email_institucional} />
          </Campo>
          <Controller control={control} name="celular" render={({ field }) => (
            <Campo id="celular" rotulo="Celular" erro={errors.celular?.message}
              ajuda="Aparece, junto com o WhatsApp, só se você habilitar abaixo.">
              <input id="celular" type="tel" inputMode="tel" autoComplete="tel" placeholder="(61) 90000-0000" {...field}
                aria-invalid={!!errors.celular} onChange={(e) => field.onChange(formatPhone(e.target.value))} />
            </Campo>
          )} />
          <Chave rotulo="Mostrar celular no perfil público" {...register('visibilidade_celular')} />
        </div>
      </section>

      <section className={styles.secao}>
        <h2>Complementar</h2>
        <div className={styles.grade2}>
          <Campo id="cargo_fce" rotulo="Cargo ou função">
            <input id="cargo_fce" maxLength={100} placeholder="ex.: Chefe de Divisão" {...register('cargo_fce')} />
          </Campo>
          <Campo id="portal_url" rotulo="Link do currículo no SouGov.br" erro={errors.portal_url?.message}>
            <input id="portal_url" type="url" inputMode="url" placeholder="https://" {...register('portal_url')} aria-invalid={!!errors.portal_url} />
          </Campo>
          <Campo id="linkedin_url" rotulo="Link do LinkedIn" erro={errors.linkedin_url?.message}>
            <input id="linkedin_url" type="url" inputMode="url" placeholder="https://www.linkedin.com/in/…" {...register('linkedin_url')} aria-invalid={!!errors.linkedin_url} />
          </Campo>
          <Campo id="lattes_url" rotulo="Link do Currículo Lattes" erro={errors.lattes_url?.message}>
            <input id="lattes_url" type="url" inputMode="url" placeholder="http://lattes.cnpq.br/…" {...register('lattes_url')} aria-invalid={!!errors.lattes_url} />
          </Campo>
          <Campo id="turma" rotulo="Turma">
            <select id="turma" {...register('turma')}>
              <option value="">Selecione…</option>
              {(Object.keys(TURMAS) as Turma[]).map((t) => <option key={t} value={t}>{TURMAS[t]}</option>)}
            </select>
          </Campo>
        </div>
      </section>

      <div className={styles.salvarBarra}>
        <p className={[styles.salvarStatus, status?.erro ? styles.erroGeral : ''].join(' ')} role="status" aria-live="polite">
          {status?.texto ?? (qtdErros ? '' : alterado ? 'Há alterações não salvas.' : '')}
        </p>
        <button type="button" className={[styles.botao, styles.secundario].join(' ')} onClick={() => {
          if (!alterado || window.confirm('Descartar as alterações que você fez?')) onCancelar()
        }}>
          {primeiroAcesso ? 'Preencher depois' : 'Cancelar'}
        </button>
        <button type="submit" className={[styles.botao, styles.primario].join(' ')} disabled={isSubmitting}>
          <IconCheck size={18} aria-hidden />{isSubmitting ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}

function Campo({ id, rotulo, obrigatorio, erro, ajuda, children }: {
  id: string; rotulo: string; obrigatorio?: boolean; erro?: string; ajuda?: string; children: ReactNode
}) {
  return (
    <div className={styles.campo}>
      <label htmlFor={id}>{rotulo}{obrigatorio && <span className={styles.obrig} aria-hidden> *</span>}</label>
      {children}
      {ajuda && <p className={styles.ajuda}>{ajuda}</p>}
      {erro && <p className={styles.erro} role="alert">{erro}</p>}
    </div>
  )
}

// Chave liga/desliga; forwardRef para funcionar com register() do react-hook-form
const Chave = forwardRef<HTMLInputElement, { rotulo: string } & InputHTMLAttributes<HTMLInputElement>>(
  function Chave({ rotulo, ...props }, ref) {
    return (
      <label className={styles.chave}>
        <input ref={ref} type="checkbox" role="switch" {...props} />
        <span className={styles.trilho} />
        {rotulo}
      </label>
    )
  },
)
