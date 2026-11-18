import { useEffect, useId, useState } from 'react'
import { IconPlus, IconX } from '@tabler/icons-react'
import type { Tema } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import styles from './perfil.module.css'

/** Temas de atuação: cada inclusão e remoção já é salva na API */
export default function EditorTemas({ temas, onChange }: { temas: Tema[]; onChange: (t: Tema[]) => void }) {
  const [texto, setTexto] = useState('')
  const [atual, setAtual] = useState(true)
  const [sugestoes, setSugestoes] = useState<string[]>([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const lista = useId()

  useEffect(() => {
    const t = window.setTimeout(() => {
      perfilApi.getTemassugestoes(texto.trim()).then(setSugestoes).catch(() => {})
    }, 250)
    return () => window.clearTimeout(t)
  }, [texto])

  const adicionar = async () => {
    const tema = texto.trim().replace(/\s+/g, ' ')
    if (!tema) return
    if (temas.some((t) => t.tema.toLowerCase() === tema.toLowerCase())) {
      setErro('Esse tema já está na sua lista.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const novo = await perfilApi.addTema({ tema, em_exercicio_atual: atual })
      onChange([...temas, novo])
      setTexto('')
    } catch {
      setErro('Não foi possível adicionar o tema. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (t: Tema) => {
    try {
      await perfilApi.deleteTema(t.id)
      onChange(temas.filter((x) => x.id !== t.id))
    } catch {
      setErro('Não foi possível remover o tema. Tente de novo.')
    }
  }

  const grupos = [
    { titulo: 'Em exercício atual', itens: temas.filter((t) => t.em_exercicio_atual), anterior: false },
    { titulo: 'Experiência anterior', itens: temas.filter((t) => !t.em_exercicio_atual), anterior: true },
  ].filter((g) => g.itens.length)

  return (
    <>
      {!temas.length && <p className={styles.vazio}>Nenhum tema cadastrado.</p>}
      {grupos.map((g) => (
        <div key={g.titulo} className={styles.grupoTemas}>
          {grupos.length > 1 && <p className={styles.subtitulo}>{g.titulo}</p>}
          <div className={styles.temasLista}>
            {g.itens.map((t) => (
              <span key={t.id} className={[styles.temaChip, g.anterior ? styles.anterior : ''].join(' ')}>
                {t.tema}
                <button type="button" onClick={() => void remover(t)} aria-label={`Remover tema ${t.tema}`}><IconX size={15} aria-hidden /></button>
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className={styles.linhaAdd}>
        <input value={texto} list={lista} maxLength={200} placeholder="Digite um tema e tecle Enter" aria-label="Novo tema de atuação"
          onChange={(e) => { setTexto(e.target.value); setErro('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void adicionar() } }} />
        <datalist id={lista}>{sugestoes.map((s) => <option key={s} value={s} />)}</datalist>
        <label className={styles.chave}>
          <input type="checkbox" role="switch" checked={atual} onChange={(e) => setAtual(e.target.checked)} />
          <span className={styles.trilho} />Em exercício atual
        </label>
        <button type="button" className={[styles.botao, styles.secundario].join(' ')} onClick={() => void adicionar()} disabled={salvando}>
          <IconPlus size={18} aria-hidden />Adicionar tema
        </button>
      </div>
      {erro && <p className={styles.erro} role="alert">{erro}</p>}
    </>
  )
}
