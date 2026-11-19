import { useEffect, useId, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { IconPlus, IconX } from '@tabler/icons-react'
import type { Tema, TemaSugestao, TipoTema } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import styles from './perfil.module.css'

const MAX_POR_TIPO = 8
const pessoas = (n: number) => (n === 1 ? '1 pessoa' : `${n} pessoas`)

interface TemaNovo { nome: string; parecidos: TemaSugestao[] }

/**
 * Temas de um tipo (Áreas de política ou Ferramentas e métodos). Digitar filtra o catálogo da Rede
 * (aceita sigla, palavra pela metade e erro de digitação). Um tema que ninguém usou ainda pode ser
 * criado, mas antes a pessoa vê os parecidos e confirma. Cada inclusão e remoção já é salva.
 */
export default function EditorTemas({ tipo, temas, onChange }: {
  tipo: TipoTema
  temas: Tema[]
  onChange: (t: Tema[]) => void
}) {
  const meus = temas.filter((t) => (t.tipo ?? 'area') === tipo)
  const [texto, setTexto] = useState('')
  const [atual, setAtual] = useState(true)
  const [sugestoes, setSugestoes] = useState<TemaSugestao[]>([])
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const [novo, setNovo] = useState<TemaNovo | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const lista = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)

  const termo = texto.trim()
  const jaTenho = new Set(meus.map((t) => t.tema_id))
  const opcoes = sugestoes.filter((s) => !jaTenho.has(s.id))
  const cheio = meus.length >= MAX_POR_TIPO
  // última opção: criar o que foi digitado (com atrito depois)
  const exato = opcoes.some((s) => s.nome.toLowerCase() === termo.toLowerCase())
  const mostraCriar = termo.length >= 2 && !exato
  const total = opcoes.length + (mostraCriar ? 1 : 0)

  useEffect(() => {
    if (!aberto) return
    const t = window.setTimeout(() => {
      perfilApi.getTemassugestoes(termo, tipo).then((s) => { setSugestoes(s); setAtivo(0) }).catch(() => {})
    }, 180)
    return () => window.clearTimeout(t)
  }, [termo, tipo, aberto])

  // fecha a lista clicando fora
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const incluir = async (escolha: { tema_id?: number; tema?: string; confirmar_novo?: boolean }) => {
    setSalvando(true)
    setErro('')
    try {
      const t = await perfilApi.addTema({ ...escolha, tipo, em_exercicio_atual: atual })
      onChange([...temas, t])
      setTexto('')
      setNovo(null)
      setAberto(false)
      campo.current?.focus()
    } catch (err) {
      const detalhe = isAxiosError(err) ? err.response?.data?.detail : null
      if (detalhe && typeof detalhe === 'object' && detalhe.codigo === 'tema_novo') {
        setNovo({ nome: detalhe.nome, parecidos: detalhe.parecidos })
        setAberto(false)
      } else {
        setErro(typeof detalhe === 'string' ? detalhe : 'Não foi possível adicionar o tema. Tente de novo.')
      }
    } finally {
      setSalvando(false)
    }
  }

  const escolherOpcao = (i: number) => {
    if (i < opcoes.length) void incluir({ tema_id: opcoes[i].id })
    else if (mostraCriar) void incluir({ tema: termo })
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
    { titulo: 'Em exercício atual', itens: meus.filter((t) => t.em_exercicio_atual), anterior: false },
    { titulo: 'Experiência anterior', itens: meus.filter((t) => !t.em_exercicio_atual), anterior: true },
  ].filter((g) => g.itens.length)

  return (
    <>
      {!meus.length && <p className={styles.vazio}>Nenhum tema cadastrado.</p>}
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

      {novo ? (
        <div className={styles.temaNovo} role="alertdialog" aria-labelledby={`${lista}-novo`}>
          <p id={`${lista}-novo`} className={styles.temaNovoTitulo}>“{novo.nome}” ainda não existe na Rede</p>
          {novo.parecidos.length > 0 ? (
            <>
              <p>Algum destes serve? Usar um tema que já existe ajuda colegas a encontrar você.</p>
              <div className={styles.temaNovoOpcoes}>
                {novo.parecidos.filter((p) => !jaTenho.has(p.id)).map((p) => (
                  <button key={p.id} type="button" className={styles.temaOpcao} disabled={salvando}
                    onClick={() => void incluir({ tema_id: p.id })}>
                    <span>{p.nome}</span><small>{pessoas(p.total)}{p.tipo !== tipo ? ` · ${p.tipo === 'area' ? 'área de política' : 'ferramenta ou método'}` : ''}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>Confira a grafia. Prefira nomes curtos e gerais: “Avaliação de impacto”, e não “Avaliação de impacto do programa X”.</p>
          )}
          <p className={styles.temaNovoNota}>Temas novos passam pela revisão da ANDEPS e podem ser ajustados ou unidos a outros.</p>
          <div className={styles.temaNovoAcoes}>
            <button type="button" className={[styles.botao, styles.secundario].join(' ')} onClick={() => { setNovo(null); campo.current?.focus() }}>
              Voltar
            </button>
            <button type="button" className={styles.linkCriar} disabled={salvando}
              onClick={() => void incluir({ tema: novo.nome, confirmar_novo: true })}>
              Criar “{novo.nome}” mesmo assim
            </button>
          </div>
        </div>
      ) : cheio ? (
        <p className={styles.temaLimite}>Você chegou ao limite de {MAX_POR_TIPO}. Remova um para incluir outro.</p>
      ) : (
        <div className={styles.linhaAdd}>
          <div className={styles.combo} ref={caixa}>
            <input ref={campo} value={texto} maxLength={120} role="combobox" aria-expanded={aberto && total > 0}
              aria-controls={lista} aria-autocomplete="list"
              aria-activedescendant={aberto && total ? `${lista}-${ativo}` : undefined}
              placeholder={tipo === 'area' ? 'Ex.: Assistência social, Saúde, Cultura' : 'Ex.: Monitoramento e avaliação, TransfereGov'}
              aria-label={tipo === 'area' ? 'Incluir área de política' : 'Incluir ferramenta ou método'}
              onFocus={() => setAberto(true)}
              onChange={(e) => { setTexto(e.target.value); setErro(''); setAberto(true) }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setAtivo((i) => Math.min(i + 1, total - 1)) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0)) }
                else if (e.key === 'Escape') setAberto(false)
                else if (e.key === 'Enter') { e.preventDefault(); if (total) escolherOpcao(aberto ? ativo : 0) }
              }} />
            {aberto && total > 0 && (
              <ul className={styles.comboLista} id={lista} role="listbox">
                {opcoes.map((s, i) => (
                  <li key={s.id} id={`${lista}-${i}`} role="option" aria-selected={i === ativo}
                    onMouseEnter={() => setAtivo(i)} onMouseDown={(e) => { e.preventDefault(); escolherOpcao(i) }}>
                    <span>{s.nome}{s.apelido && <em> ({s.apelido})</em>}</span>
                    <small>{s.total ? pessoas(s.total) : 'novo'}</small>
                  </li>
                ))}
                {mostraCriar && (
                  <li id={`${lista}-${opcoes.length}`} role="option" aria-selected={ativo === opcoes.length} className={styles.comboCriar}
                    onMouseEnter={() => setAtivo(opcoes.length)} onMouseDown={(e) => { e.preventDefault(); escolherOpcao(opcoes.length) }}>
                    <IconPlus size={16} aria-hidden /><span>Criar tema novo: “{termo}”</span>
                  </li>
                )}
              </ul>
            )}
          </div>
          <label className={styles.chave}>
            <input type="checkbox" role="switch" checked={atual} onChange={(e) => setAtual(e.target.checked)} />
            <span className={styles.trilho} />Em exercício atual
          </label>
          <span className={styles.temaConta}>{meus.length} de {MAX_POR_TIPO}</span>
        </div>
      )}
      {erro && <p className={styles.erro} role="alert">{erro}</p>}
    </>
  )
}
