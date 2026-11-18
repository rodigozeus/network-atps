import { useState } from 'react'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import type { Formacao, NivelFormacao } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import { NIVEIS, ORDEM_NIVEIS, ordenarFormacoes } from '@shared/utils/analista'
import styles from './perfil.module.css'

/** Formação acadêmica: lista com remoção e um formulário para incluir; cada ação já é salva na API */
export default function EditorFormacoes({ formacoes, onChange }: { formacoes: Formacao[]; onChange: (f: Formacao[]) => void }) {
  const [nivel, setNivel] = useState<NivelFormacao | ''>('')
  const [instituicao, setInstituicao] = useState('')
  const [curso, setCurso] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const adicionar = async () => {
    if (!nivel || !curso.trim() || !instituicao.trim()) {
      setErro('Informe o nível, a instituição e o curso.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const nova = await perfilApi.addFormacao({ nivel, curso: curso.trim(), instituicao: instituicao.trim() })
      onChange([...formacoes, nova])
      setNivel('')
      setInstituicao('')
      setCurso('')
    } catch {
      setErro('Não foi possível adicionar a formação. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (f: Formacao) => {
    try {
      await perfilApi.deleteFormacao(f.id)
      onChange(formacoes.filter((x) => x.id !== f.id))
    } catch {
      setErro('Não foi possível remover a formação. Tente de novo.')
    }
  }

  return (
    <>
      {formacoes.length ? (
        <ul className={styles.formacoesEdit}>
          {ordenarFormacoes(formacoes).map((f) => (
            <li key={f.id}>
              <span className={styles.nivel}>{NIVEIS[f.nivel]}</span>
              <span className={styles.formacaoTexto}><strong>{f.curso}</strong><span>{f.instituicao}</span></span>
              <button type="button" className={styles.iconeBtn} onClick={() => void remover(f)} aria-label={`Remover formação ${f.curso}`} title="Remover formação">
                <IconTrash size={18} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : <p className={styles.vazio}>Nenhuma formação cadastrada.</p>}

      <div className={styles.formacaoNova}>
        <div className={styles.campo}>
          <label htmlFor="fm-nivel">Nível</label>
          <select id="fm-nivel" value={nivel} onChange={(e) => setNivel(e.target.value as NivelFormacao | '')}>
            <option value="">Selecione…</option>
            {ORDEM_NIVEIS.map((n) => <option key={n} value={n}>{NIVEIS[n]}</option>)}
          </select>
        </div>
        <div className={styles.campo}>
          <label htmlFor="fm-inst">Instituição</label>
          <input id="fm-inst" value={instituicao} maxLength={200} placeholder="ex.: Universidade de Brasília (UnB)" onChange={(e) => setInstituicao(e.target.value)} />
        </div>
        <div className={styles.campo}>
          <label htmlFor="fm-curso">Curso</label>
          <input id="fm-curso" value={curso} maxLength={200} placeholder="ex.: Políticas Públicas" onChange={(e) => setCurso(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void adicionar() } }} />
        </div>
        <button type="button" className={[styles.botao, styles.secundario].join(' ')} onClick={() => void adicionar()} disabled={salvando}>
          <IconPlus size={18} aria-hidden />Adicionar formação
        </button>
      </div>
      {erro && <p className={styles.erro} role="alert">{erro}</p>}
    </>
  )
}
