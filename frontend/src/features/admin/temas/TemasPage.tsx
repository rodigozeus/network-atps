import { useCallback, useEffect, useMemo, useState } from 'react'
import { isAxiosError } from 'axios'
import { Button } from '@shared/components'
import type { TemaAdmin, TemasAdmin, TipoTema } from '../api/admin'
import { criarTema, editarTema, excluirTema, getTemas, juntarTema, reprovarTema } from '../api/admin'
import styles from '../admin.module.css'
import t from './temas.module.css'
import { useAdmin } from '../AdminLayout'

const TIPOS: Record<TipoTema, string> = { area: 'Área de política', ferramenta: 'Ferramenta ou método' }
const pessoas = (n: number) => (n === 1 ? '1 pessoa' : `${n} pessoas`)
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function mensagem(err: unknown): string {
  const d = isAxiosError(err) ? err.response?.data?.detail : null
  return typeof d === 'string' ? d : 'Não foi possível concluir. Tente de novo.'
}

type Filtro = 'todos' | 'revisar' | 'reprovados' | TipoTema
const GRUPOS = [['area', 'Áreas de política'], ['ferramenta', 'Ferramentas e métodos']] as const

/** Curadoria do catálogo de temas: revisar os criados por pessoas, juntar duplicados, renomear,
 *  mudar o tipo e cuidar dos apelidos (siglas e grafias que levam ao tema oficial). */
export default function TemasPage() {
  const [dados, setDados] = useState<TemasAdmin | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [editando, setEditando] = useState<TemaAdmin | 'novo' | null>(null)
  const [juntando, setJuntando] = useState<TemaAdmin | null>(null)
  const [reprovando, setReprovando] = useState<TemaAdmin | null>(null)
  const { recarregarPendencias } = useAdmin()

  const carregar = useCallback(() => {
    getTemas().then(setDados).catch(() => setErro('Não foi possível carregar os temas.'))
  }, [])
  useEffect(carregar, [carregar])

  const agir = async (acao: () => Promise<unknown>) => {
    setErro('')
    try {
      await acao()
      carregar()
      recarregarPendencias()
      return true
    } catch (err) {
      setErro(mensagem(err))
      return false
    }
  }

  const lista = useMemo(() => {
    if (!dados) return []
    const q = semAcento(busca.trim())
    return dados.temas.filter((x) =>
      (filtro === 'reprovados' ? x.reprovado : !x.reprovado)
      && (filtro === 'todos' || filtro === 'reprovados' || (filtro === 'revisar' ? !x.revisado : x.tipo === filtro))
      && (!q || semAcento([x.nome, ...x.apelidos].join(' ')).includes(q)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
  }, [dados, busca, filtro])

  if (!dados) return <p className={styles.empty}>{erro || 'Carregando…'}</p>

  const ativos = dados.temas.filter((x) => !x.reprovado)
  const aRevisar = ativos.filter((x) => !x.revisado).length
  const reprovados = dados.temas.length - ativos.length

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Temas</h1>
        <Button size="sm" onClick={() => setEditando('novo')}>Novo tema</Button>
      </div>
      <p className={t.intro}>
        {ativos.length} temas no catálogo, {aRevisar} a revisar. Temas criados por pessoas entram como “a revisar”.
        Junte os duplicados (todo mundo passa para o tema que fica, e o nome antigo vira apelido) e marque os bons como revisados.
      </p>
      {erro && <p className={t.erro} role="alert">{erro}</p>}

      {dados.pares.length > 0 && (
        <section className={t.pares} aria-labelledby="titulo-pares">
          <h2 id="titulo-pares" className={styles.chartTitle}>Parecidos para revisar</h2>
          <ul>
            {dados.pares.map(({ a, b, similaridade }) => {
              const novo = a.revisado ? b : a
              return (
                <li key={`${a.id}-${b.id}`}>
                  <div className={t.par}>
                    <NomeTema x={a} /><span className={t.parSim} title="Semelhança">{Math.round(similaridade * 100)}%</span><NomeTema x={b} />
                  </div>
                  <div className={styles.actions}>
                    <Button size="sm" variant="outline" onClick={() => void agir(() => juntarTema(a.id, b.id))}>Manter “{b.nome}”</Button>
                    <Button size="sm" variant="outline" onClick={() => void agir(() => juntarTema(b.id, a.id))}>Manter “{a.nome}”</Button>
                    <Button size="sm" variant="ghost" onClick={() => void agir(() => editarTema(novo.id, { revisado: true }))}>São diferentes</Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className={styles.toolbar} style={{ margin: 'var(--sp-5) 0 var(--sp-3)' }}>
        <input className={styles.searchInput} type="search" placeholder="Buscar tema ou apelido" value={busca}
          onChange={(e) => setBusca(e.target.value)} aria-label="Buscar tema" />
        <select className={styles.filterSelect} value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Mostrar">
          <option value="todos">Todos</option>
          <option value="revisar">A revisar ({aRevisar})</option>
          <option value="area">Áreas de política</option>
          <option value="ferramenta">Ferramentas e métodos</option>
          {reprovados > 0 && <option value="reprovados">Reprovados ({reprovados})</option>}
        </select>
      </div>

      {!lista.length && <p className={styles.empty}>Nenhum tema com esse filtro.</p>}
      {filtro === 'reprovados' && lista.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Tema reprovado</th><th>Ações</th></tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id}>
                  <td><strong>{x.nome}</strong><small className={t.apelidos}>{TIPOS[x.tipo]}. Ninguém consegue usar este nome enquanto estiver reprovado.</small></td>
                  <td>
                    <div className={styles.actions}>
                      <Button size="sm" variant="outline" onClick={() => void agir(() => editarTema(x.id, { reprovado: false }))}>Desfazer</Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (window.confirm(`Apagar “${x.nome}” de vez? O nome deixa de ficar bloqueado.`)) void agir(() => excluirTema(x.id))
                      }}>Apagar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtro !== 'reprovados' && GRUPOS.map(([tipo, titulo]) => {
        const itens = lista.filter((x) => x.tipo === tipo)
        if (!itens.length) return null
        const pendentes = itens.filter((x) => !x.revisado).length
        return (
          <section key={tipo} className={t.grupo} aria-labelledby={`grupo-${tipo}`}>
            <h2 id={`grupo-${tipo}`} className={t.grupoTitulo}>
              {titulo} <small>{itens.length} {itens.length === 1 ? 'tema' : 'temas'}{pendentes ? `, ${pendentes} a revisar` : ''}</small>
            </h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Tema</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Pessoas</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((x) => (
                  <tr key={x.id} className={x.revisado ? '' : styles.rowPendente}>
                    <td>
                      <NomeTema x={x} />
                      {x.apelidos.length > 0 && <small className={t.apelidos}>Apelidos: {x.apelidos.join(' · ')}</small>}
                      {!x.revisado && x.criado_por && (
                        <small className={t.apelidos}>Criado por {x.criado_por}{x.criado_em ? ` em ${new Date(x.criado_em).toLocaleDateString('pt-BR')}` : ''}</small>
                      )}
                    </td>
                    <td>
                      <select className={styles.filterSelect} value={x.tipo} aria-label={`Tipo de ${x.nome}`}
                        onChange={(e) => void agir(() => editarTema(x.id, { tipo: e.target.value as TipoTema }))}>
                        <option value="area">{TIPOS.area}</option>
                        <option value="ferramenta">{TIPOS.ferramenta}</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'right' }}>{x.total}</td>
                    <td>
                      <div className={styles.actions}>
                        {!x.revisado && (
                          <Button size="sm" onClick={() => void agir(() => editarTema(x.id, { revisado: true }))}>Aprovar</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setEditando(x)}>Editar</Button>
                        <Button size="sm" variant="outline" onClick={() => setJuntando(x)}>Juntar…</Button>
                        <Button size="sm" variant="outline" onClick={() => setReprovando(x)}>Reprovar…</Button>
                        {x.total === 0 && (
                          <Button size="sm" variant="ghost" onClick={() => {
                            if (window.confirm(`Excluir o tema “${x.nome}”? Ninguém o usa.`)) void agir(() => excluirTema(x.id))
                          }}>Excluir</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {editando && (
        <EditarTema tema={editando === 'novo' ? null : editando} onFechar={() => setEditando(null)}
          onSalvar={async (body) => {
            const ok = await agir(() => (editando === 'novo' ? criarTema(body) : editarTema(editando.id, body)))
            if (ok) setEditando(null)
          }} />
      )}
      {juntando && (
        <JuntarTema origem={juntando} temas={ativos} onFechar={() => setJuntando(null)}
          onJuntar={async (destino) => {
            const ok = await agir(() => juntarTema(juntando.id, destino.id))
            if (ok) setJuntando(null)
          }} />
      )}
      {reprovando && (
        <ReprovarTema tema={reprovando} temas={ativos} onFechar={() => setReprovando(null)}
          onReprovar={async (substituto) => {
            const ok = await agir(() => reprovarTema(reprovando.id, substituto?.id ?? null))
            if (ok) setReprovando(null)
          }} />
      )}
    </div>
  )
}

function NomeTema({ x }: { x: TemaAdmin }) {
  return (
    <span className={t.nome}>
      <strong>{x.nome}</strong>
      <small>{TIPOS[x.tipo]} · {pessoas(x.total)}</small>
      {!x.revisado && <span className={styles.badgePendente}>a revisar</span>}
    </span>
  )
}

function EditarTema({ tema, onFechar, onSalvar }: {
  tema: TemaAdmin | null
  onFechar: () => void
  onSalvar: (body: { nome: string; tipo: TipoTema; apelidos: string[]; revisado?: boolean }) => Promise<void>
}) {
  const [nome, setNome] = useState(tema?.nome ?? '')
  const [tipo, setTipo] = useState<TipoTema>(tema?.tipo ?? 'area')
  const [apelidos, setApelidos] = useState((tema?.apelidos ?? []).join('\n'))
  const [salvando, setSalvando] = useState(false)

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    await onSalvar({
      nome: nome.trim(), tipo, apelidos: apelidos.split('\n').map((a) => a.trim()).filter(Boolean),
      ...(tema && !tema.revisado ? { revisado: true } : {}),
    })
    setSalvando(false)
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="titulo-editar-tema">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} id="titulo-editar-tema">{tema ? 'Editar tema' : 'Novo tema'}</h2>
          <button className={styles.closeBtn} onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <form onSubmit={(e) => void salvar(e)}>
          <div className={styles.formGrid}>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel} htmlFor="tema-nome">Nome oficial</label>
              <input id="tema-nome" className={styles.formInput} value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} maxLength={120} />
              {tema && nome.trim() !== tema.nome && <small className={t.apelidos}>Os perfis passam a mostrar o nome novo; “{tema.nome}” vira apelido.</small>}
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel} htmlFor="tema-tipo">Tipo</label>
              <select id="tema-tipo" className={styles.formSelect} value={tipo} onChange={(e) => setTipo(e.target.value as TipoTema)}>
                <option value="area">{TIPOS.area}</option>
                <option value="ferramenta">{TIPOS.ferramenta}</option>
              </select>
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel} htmlFor="tema-apelidos">Apelidos (um por linha)</label>
              <textarea id="tema-apelidos" className={styles.formInput} rows={5} value={apelidos} onChange={(e) => setApelidos(e.target.value)}
                placeholder={'Siglas e outras grafias do MESMO tema, ex.:\nTED\nTEDs'} />
              <small className={t.apelidos}>Quem digita um apelido cai neste tema, e a busca também o reconhece.</small>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <Button type="button" variant="ghost" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" loading={salvando}>{tema && !tema.revisado ? 'Salvar e aprovar' : 'Salvar'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function JuntarTema({ origem, temas, onFechar, onJuntar }: {
  origem: TemaAdmin
  temas: TemaAdmin[]
  onFechar: () => void
  onJuntar: (destino: TemaAdmin) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [destino, setDestino] = useState<TemaAdmin | null>(null)
  const [salvando, setSalvando] = useState(false)
  const opcoes = useMemo(() => {
    const k = semAcento(q.trim())
    return temas
      .filter((x) => x.id !== origem.id && (!k || semAcento([x.nome, ...x.apelidos].join(' ')).includes(k)))
      .sort((a, b) => Number(b.revisado) - Number(a.revisado) || b.total - a.total)
      .slice(0, 8)
  }, [q, temas, origem.id])

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="titulo-juntar">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} id="titulo-juntar">Juntar “{origem.nome}”</h2>
          <button className={styles.closeBtn} onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <p className={t.intro}>
          As {pessoas(origem.total)} com “{origem.nome}” passam a ter o tema escolhido abaixo. “{origem.nome}” deixa de existir e vira apelido dele.
        </p>
        <input className={styles.formInput} type="search" placeholder="Buscar o tema que fica" value={q} autoFocus
          onChange={(e) => { setQ(e.target.value); setDestino(null) }} aria-label="Buscar o tema que fica" />
        <ul className={t.escolha}>
          {opcoes.map((x) => (
            <li key={x.id}>
              <button type="button" aria-pressed={destino?.id === x.id} onClick={() => setDestino(x)}><NomeTema x={x} /></button>
            </li>
          ))}
        </ul>
        <div className={styles.modalFooter}>
          <Button type="button" variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button disabled={!destino} loading={salvando} onClick={async () => {
            if (!destino) return
            setSalvando(true)
            await onJuntar(destino)
            setSalvando(false)
          }}>{destino ? `Juntar em “${destino.nome}”` : 'Escolha o tema'}</Button>
        </div>
      </div>
    </div>
  )
}

function ReprovarTema({ tema, temas, onFechar, onReprovar }: {
  tema: TemaAdmin
  temas: TemaAdmin[]
  onFechar: () => void
  onReprovar: (substituto: TemaAdmin | null) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [substituto, setSubstituto] = useState<TemaAdmin | null>(null)
  const [salvando, setSalvando] = useState(false)
  const opcoes = useMemo(() => {
    const k = semAcento(q.trim())
    if (!k) return []
    return temas
      .filter((x) => x.id !== tema.id && semAcento([x.nome, ...x.apelidos].join(' ')).includes(k))
      .sort((a, b) => Number(b.revisado) - Number(a.revisado) || b.total - a.total)
      .slice(0, 6)
  }, [q, temas, tema.id])

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="titulo-reprovar">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} id="titulo-reprovar">Reprovar “{tema.nome}”</h2>
          <button className={styles.closeBtn} onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <p className={t.intro}>
          O tema sai do catálogo{tema.total ? ` e dos perfis (${pessoas(tema.total)})` : ''}, e o nome fica bloqueado: ninguém consegue criá-lo de novo.
          Se for só outro jeito de dizer um tema que já existe, use Juntar.
        </p>
        {tema.total > 0 && (
          <>
            <label className={styles.formLabel} htmlFor="reprovar-busca">Colocar outro tema no lugar (opcional)</label>
            <input id="reprovar-busca" className={styles.formInput} type="search" placeholder="Buscar tema substituto" value={q}
              onChange={(e) => { setQ(e.target.value); setSubstituto(null) }} />
            <ul className={t.escolha}>
              {opcoes.map((x) => (
                <li key={x.id}>
                  <button type="button" aria-pressed={substituto?.id === x.id}
                    onClick={() => setSubstituto(substituto?.id === x.id ? null : x)}><NomeTema x={x} /></button>
                </li>
              ))}
            </ul>
            <p className={t.apelidos}>
              {substituto ? `Quem tinha “${tema.nome}” passa a ter “${substituto.nome}”.` : `Sem substituto, “${tema.nome}” só sai dos perfis.`}
            </p>
          </>
        )}
        <div className={styles.modalFooter}>
          <Button type="button" variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button variant="danger" loading={salvando} onClick={async () => {
            setSalvando(true)
            await onReprovar(substituto)
            setSalvando(false)
          }}>Reprovar</Button>
        </div>
      </div>
    </div>
  )
}
