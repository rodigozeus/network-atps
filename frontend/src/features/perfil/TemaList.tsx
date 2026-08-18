import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Tema } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import { Button, Input, Tag } from '@shared/components'
import styles from './perfil.module.css'

const schema = z.object({
  tema: z.string().min(2, 'Campo obrigatório'),
  em_exercicio_atual: z.boolean(),
})

type FormData = z.infer<typeof schema>

interface Props {
  temas: Tema[]
  onChange: (temas: Tema[]) => void
}

interface ComboboxProps {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  error?: string
}

function TemaCombobox({ value, onChange, onBlur, error }: ComboboxProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      const results = await perfilApi.getTemassugestoes(value)
      setSuggestions(results)
      setOpen(results.length > 0)
    }, 250)
    return () => clearTimeout(timer)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className={styles.comboboxWrapper}>
      <Input
        label="Tema"
        placeholder="ex.: Compras Públicas"
        error={error}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {open && (
        <ul className={styles.comboboxDropdown} role="listbox">
          {suggestions.map((s) => (
            <li
              key={s}
              role="option"
              aria-selected={false}
              className={styles.comboboxItem}
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(s)
                setOpen(false)
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function TemaList({ temas, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { control, handleSubmit, reset, register, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tema: '', em_exercicio_atual: true },
  })

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await perfilApi.deleteTema(id)
      onChange(temas.filter((t) => t.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const onSubmit = async (data: FormData) => {
    const added = await perfilApi.addTema(data)
    onChange([...temas, added])
    reset()
    setAdding(false)
  }

  return (
    <div className={styles.listCard}>
      <p className={styles.formCardTitle}>Temas de Atuação</p>

      {temas.length === 0 && !adding && (
        <p className={styles.listEmpty}>Nenhum tema cadastrado.</p>
      )}

      {temas.map((t) => (
        <div key={t.id} className={styles.listItem}>
          <div className={styles.listItemMain}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Tag variant={t.em_exercicio_atual ? 'success' : 'neutral'} active={t.em_exercicio_atual}>
                {t.tema}
              </Tag>
            </div>
            <div className={styles.listItemSub}>
              {t.em_exercicio_atual ? 'Em exercício atual' : 'Experiência anterior'}
            </div>
          </div>
          <button
            className={styles.deleteBtn}
            onClick={() => handleDelete(t.id)}
            disabled={deletingId === t.id}
            aria-label="Remover tema"
          >
            <TrashIcon />
          </button>
        </div>
      ))}

      <div className={styles.addFormToggle}>
        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            + Adicionar tema
          </Button>
        ) : (
          <form className={styles.addForm} onSubmit={handleSubmit(onSubmit)} noValidate>
            <Controller
              control={control}
              name="tema"
              render={({ field, fieldState }) => (
                <TemaCombobox
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />

            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                className={styles.toggle}
                {...register('em_exercicio_atual')}
              />
              Em exercício atual
            </label>

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
