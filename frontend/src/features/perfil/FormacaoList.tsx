import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Formacao, NivelFormacao } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import { Button, Input } from '@shared/components'
import styles from './perfil.module.css'

const NIVEIS: { value: NivelFormacao; label: string }[] = [
  { value: 'graduacao', label: 'Graduação' },
  { value: 'especializacao', label: 'Especialização' },
  { value: 'mestrado', label: 'Mestrado' },
  { value: 'doutorado', label: 'Doutorado' },
]

const schema = z.object({
  nivel: z.enum(['graduacao', 'especializacao', 'mestrado', 'doutorado'] as const),
  curso: z.string().min(2, 'Campo obrigatório'),
  instituicao: z.string().min(2, 'Campo obrigatório'),
})

type FormData = z.infer<typeof schema>

interface Props {
  formacoes: Formacao[]
  onChange: (formacoes: Formacao[]) => void
}

export default function FormacaoList({ formacoes, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nivel: 'graduacao', curso: '', instituicao: '' },
  })

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await perfilApi.deleteFormacao(id)
      onChange(formacoes.filter((f) => f.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const onSubmit = async (data: FormData) => {
    const added = await perfilApi.addFormacao(data)
    onChange([...formacoes, added])
    reset()
    setAdding(false)
  }

  return (
    <div className={styles.listCard}>
      <p className={styles.formCardTitle}>Formação Acadêmica</p>

      {formacoes.length === 0 && !adding && (
        <p className={styles.listEmpty}>Nenhuma formação cadastrada.</p>
      )}

      {formacoes.map((f) => (
        <div key={f.id} className={styles.listItem}>
          <div className={styles.listItemMain}>
            <div className={styles.listItemPrimary}>{f.curso}</div>
            <div className={styles.listItemSub}>
              {NIVEIS.find((n) => n.value === f.nivel)?.label} · {f.instituicao}
            </div>
          </div>
          <button
            className={styles.deleteBtn}
            onClick={() => handleDelete(f.id)}
            disabled={deletingId === f.id}
            aria-label="Remover formação"
          >
            <TrashIcon />
          </button>
        </div>
      ))}

      <div className={styles.addFormToggle}>
        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            + Adicionar formação
          </Button>
        ) : (
          <form className={styles.addForm} onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label className={styles.selectLabel}>Nível</label>
              <div className={styles.selectWrapper}>
                <select className={styles.select} {...register('nivel')}>
                  {NIVEIS.map((n) => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.addFormRow}>
              <Input
                label="Curso"
                placeholder="ex.: Administração Pública"
                error={errors.curso?.message}
                {...register('curso')}
              />
              <Input
                label="Instituição"
                placeholder="ex.: UnB"
                error={errors.instituicao?.message}
                {...register('instituicao')}
              />
            </div>

            <div className={styles.addFormActions}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setAdding(false); reset() }}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" loading={isSubmitting}>
                Adicionar
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}
