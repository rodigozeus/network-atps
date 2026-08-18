import { forwardRef, useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { AnalistaOut } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import { Button, Input } from '@shared/components'
import { formatPhone } from '@shared/utils/phone'
import styles from './perfil.module.css'

const str = z.string().optional()
const phoneRegex = /^\(\d{2}\) \d{4,5}-\d{4}$/
const optionalEmail = z
  .string()
  .optional()
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'E-mail inválido' })

const TURMAS: { value: string; label: string }[] = [
  { value: 'turma_2012', label: 'Turma de 2012' },
  { value: 'turma_2016', label: 'Turma de 2016' },
  { value: 'turma_2024_cpnu', label: 'Turma de 2024 (CPNU)' },
]

const schema = z.object({
  nome: z.string().min(3, 'Mínimo 3 caracteres'),
  email_pessoal: z.string().email('E-mail inválido'),
  telefone_institucional: z
    .string()
    .optional()
    .refine((v) => !v || phoneRegex.test(v), { message: 'Telefone inválido' }),
  ministerio: str,
  ministerio_sigla: str,
  secretaria: str,
  secretaria_sigla: str,
  departamento: str,
  departamento_sigla: str,
  coordenacao_geral: str,
  coordenacao: str,
  email_institucional: optionalEmail,
  celular: z
    .string()
    .optional()
    .refine((v) => !v || phoneRegex.test(v), { message: 'Celular inválido' }),
  visibilidade_email_pessoal: z.boolean(),
  visibilidade_celular: z.boolean(),
  cargo_fce: str,
  portal_url: str,
  turma: str,
})

type FormData = z.infer<typeof schema>

interface Props {
  profile: AnalistaOut
  onSave: (updated: AnalistaOut) => void
  onSubmittingChange?: (isSubmitting: boolean) => void
}

function cleanPayload(data: FormData) {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== ''),
  )
}

function getInitials(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

const ProfileEditForm = forwardRef<HTMLFormElement, Props>(
  function ProfileEditForm({ profile, onSave, onSubmittingChange }, formRef) {
    const [confirmField, setConfirmField] = useState<'email' | 'celular' | null>(null)
    const [fotoFile, setFotoFile] = useState<File | null>(null)
    const [fotoPreview, setFotoPreview] = useState<string | null>(
      profile.foto_path ? `/${profile.foto_path}` : null,
    )
    const [uploadingFoto, setUploadingFoto] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const {
      register,
      control,
      handleSubmit,
      setError,
      setValue,
      formState: { errors, isSubmitting },
    } = useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        nome: profile.nome,
        email_pessoal: profile.email_pessoal,
        telefone_institucional: formatPhone(profile.telefone_institucional ?? ''),
        ministerio: profile.ministerio ?? '',
        ministerio_sigla: profile.ministerio_sigla ?? '',
        secretaria: profile.secretaria ?? '',
        secretaria_sigla: profile.secretaria_sigla ?? '',
        departamento: profile.departamento ?? '',
        departamento_sigla: profile.departamento_sigla ?? '',
        coordenacao_geral: profile.coordenacao_geral ?? '',
        coordenacao: profile.coordenacao ?? '',
        email_institucional: profile.email_institucional ?? '',
        celular: formatPhone(profile.celular ?? ''),
        visibilidade_email_pessoal: profile.visibilidade_email_pessoal,
        visibilidade_celular: profile.visibilidade_celular,
        cargo_fce: profile.cargo_fce ?? '',
        portal_url: profile.portal_url ?? '',
        turma: profile.turma ?? '',
      },
    })

    useEffect(() => {
      onSubmittingChange?.(isSubmitting)
    }, [isSubmitting, onSubmittingChange])

    const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setFotoFile(file)
      setFotoPreview(URL.createObjectURL(file))
    }

    const handleUploadFoto = async () => {
      if (!fotoFile) return
      setUploadingFoto(true)
      setUploadError(null)
      try {
        const updated = await perfilApi.uploadFoto(fotoFile)
        onSave(updated)
      } catch {
        setUploadError('Erro ao enviar foto. Tente novamente.')
      } finally {
        setUploadingFoto(false)
      }
    }

    const onSubmit = async (data: FormData) => {
      try {
        const payload = cleanPayload(data)
        const updated = await perfilApi.updateMe(payload)
        onSave(updated)
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
        const msg =
          typeof detail === 'string'
            ? detail
            : 'Erro ao salvar perfil. Tente novamente.'
        setError('root', { message: msg })
      }
    }

    return (
      <div className={styles.editPage}>
        {/* Foto */}
        <div className={styles.formCard}>
          <p className={styles.formCardTitle}>Foto de Perfil</p>
          <div className={styles.fotoSection}>
            {fotoPreview ? (
              <img src={fotoPreview} alt="Foto de perfil" className={styles.fotoPreview} />
            ) : (
              <div className={styles.fotoInitials}>{getInitials(profile.nome)}</div>
            )}
            <div className={styles.fotoActions}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={styles.fotoInput}
                onChange={handleFotoChange}
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Escolher imagem
              </Button>
              {fotoFile && (
                <Button size="sm" type="button" loading={uploadingFoto} onClick={handleUploadFoto}>
                  {uploadingFoto ? 'Enviando…' : 'Enviar foto'}
                </Button>
              )}
              {uploadError && <p className={styles.apiError}>{uploadError}</p>}
            </div>
          </div>
        </div>

        {/* Main form — ref exposto para ProfilePage acionar requestSubmit() */}
        <form ref={formRef} id="profile-edit-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {errors.root && <p className={styles.apiError}>{errors.root.message}</p>}

          {/* Dados básicos */}
          <div className={styles.formCard} style={{ marginBottom: 'var(--sp-5)' }}>
            <p className={styles.formCardTitle}>Dados Básicos</p>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldFull}>
                <Input
                  label="Nome completo"
                  error={errors.nome?.message}
                  {...register('nome')}
                />
              </div>
              <div>
                <Input
                  label="E-mail pessoal"
                  type="email"
                  hint="Usado para acesso — não compartilhado sem autorização"
                  error={errors.email_pessoal?.message}
                  {...register('email_pessoal')}
                />
                <div className={styles.visibilityRow}>
                  <Controller
                    control={control}
                    name="visibilidade_email_pessoal"
                    render={({ field }) => (
                      <input
                        id="vis-email"
                        type="checkbox"
                        className={styles.toggle}
                        checked={field.value}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConfirmField('email')
                          } else {
                            field.onChange(false)
                          }
                        }}
                      />
                    )}
                  />
                  <label htmlFor="vis-email" className={styles.toggleLabel}>
                    Mostrar e-mail pessoal no perfil público
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Órgão de exercício */}
          <div className={styles.formCard} style={{ marginBottom: 'var(--sp-5)' }}>
            <p className={styles.formCardTitle}>Órgão de exercício</p>
            <div className={styles.fieldGrid}>
              <Input label="Ministério" {...register('ministerio')} />
              <Input label="Sigla do Ministério" {...register('ministerio_sigla')} />
              <Input label="Secretaria" {...register('secretaria')} />
              <Input label="Sigla da Secretaria" {...register('secretaria_sigla')} />
              <Input label="Departamento" {...register('departamento')} />
              <Input label="Sigla do Departamento" {...register('departamento_sigla')} />
              <Input label="Coordenação Geral" {...register('coordenacao_geral')} />
              <Input label="Coordenação" {...register('coordenacao')} />
            </div>
          </div>

          {/* Contato + visibilidade */}
          <div className={styles.formCard} style={{ marginBottom: 'var(--sp-5)' }}>
            <p className={styles.formCardTitle}>Contato</p>
            <div className={styles.formRow}>
              <Controller
                control={control}
                name="telefone_institucional"
                render={({ field, fieldState }) => (
                  <Input
                    label="Telefone institucional"
                    type="tel"
                    error={fieldState.error?.message}
                    {...field}
                    onChange={(e) => field.onChange(formatPhone(e.target.value))}
                  />
                )}
              />
              <div>
                <Input
                  label="E-mail institucional"
                  type="email"
                  hint="Visível no seu perfil público se preenchido"
                  error={errors.email_institucional?.message}
                  {...register('email_institucional')}
                />
              </div>
              <div>
                <Controller
                  control={control}
                  name="celular"
                  render={({ field, fieldState }) => (
                    <Input
                      label="Celular"
                      type="tel"
                      hint="Visível apenas se habilitado abaixo"
                      error={fieldState.error?.message}
                      {...field}
                      onChange={(e) => field.onChange(formatPhone(e.target.value))}
                    />
                  )}
                />
                <div className={styles.visibilityRow}>
                  <Controller
                    control={control}
                    name="visibilidade_celular"
                    render={({ field }) => (
                      <input
                        id="vis-cel"
                        type="checkbox"
                        className={styles.toggle}
                        checked={field.value}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConfirmField('celular')
                          } else {
                            field.onChange(false)
                          }
                        }}
                      />
                    )}
                  />
                  <label htmlFor="vis-cel" className={styles.toggleLabel}>
                    Mostrar celular no perfil público
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Complementar */}
          <div className={styles.formCard} style={{ marginBottom: 'var(--sp-5)' }}>
            <p className={styles.formCardTitle}>Complementar</p>
            <div className={styles.fieldGrid}>
              <Input label="Cargo/Função" placeholder="ex.: Chefe de Divisão" {...register('cargo_fce')} />
              <Input label="Link Currículo SouGov.br" type="url" {...register('portal_url')} />
              <div>
                <label className={styles.selectLabel}>Turma</label>
                <div className={styles.selectWrapper}>
                  <select className={styles.select} {...register('turma')}>
                    <option value="">Selecione…</option>
                    {TURMAS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </form>

        {confirmField && (
          <div className={styles.modalOverlay} role="dialog" aria-modal="true">
            <div className={styles.modal}>
              <p className={styles.modalTitle}>Confirmação de visibilidade</p>
              <p className={styles.modalText}>
                Ao tornar {confirmField === 'email' ? 'seu e-mail pessoal' : 'seu celular'} visível,
                você autoriza a <strong>Rede ATPS</strong> a exibi-lo para os demais usuários
                cadastrados na plataforma, em conformidade com a{' '}
                <strong>Lei Geral de Proteção de Dados (LGPD)</strong>. Você poderá revogar essa
                autorização a qualquer momento editando seu perfil.
              </p>
              <div className={styles.modalActions}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmField(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (confirmField === 'email') {
                      setValue('visibilidade_email_pessoal', true)
                    } else {
                      setValue('visibilidade_celular', true)
                    }
                    setConfirmField(null)
                  }}
                >
                  Confirmar e tornar visível
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)

export default ProfileEditForm
