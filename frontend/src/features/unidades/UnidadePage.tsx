import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  IconAt, IconBriefcase, IconBuilding, IconChevronDown, IconChevronRight, IconMapPin, IconPhone, IconUsers, IconWorld,
} from '@tabler/icons-react'
import type { Unidade } from '@shared/api/types'
import { unidadesApi } from '@shared/api/unidades'
import { Spinner } from '@shared/components'
import { gradienteOrgao } from '@shared/utils/analista'
import AnalistaLinha from '@features/busca/AnalistaLinha'
import busca from '@features/busca/busca.module.css'
import perfil from '@features/perfil/perfil.module.css'
import styles from './unidades.module.css'

const NIVEL: Record<string, string> = {
  ministerio: 'Órgão', secretaria: 'Secretaria', departamento: 'Departamento',
  coordenacao_geral: 'Coordenação-Geral', coordenacao: 'Coordenação',
}
const COMPETENCIA_CURTA = 520

/** Competências do SIORG costumam vir como itens numerados numa linha só ("I - ...; II - ...;
 *  e III - ..."). Quebra a linha antes de cada item (I, II..., 1, 2..., a, b...) para ler melhor. */
function emItens(texto: string): string[] {
  return texto
    .replace(/\s*([;:])(\s+e)?\s+(?=(?:[IVXLC]{1,7}|\d{1,3}|[a-z])\s?[-–—).]\s)/g, (_, sinal: string, e?: string) => `${sinal}${e ?? ''}\n`)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/** Página de uma unidade da estrutura oficial (SIORG): o que faz, contato e quem está ali. */
export default function UnidadePage() {
  const { id } = useParams<{ id: string }>()
  const [u, setU] = useState<Unidade | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [tudo, setTudo] = useState(false)
  const [verSub, setVerSub] = useState(false)
  const suspensa = useRef<HTMLDivElement>(null)

  // lista suspensa: fecha com Esc ou clicando fora
  useEffect(() => {
    if (!verSub) return
    const fora = (e: MouseEvent) => { if (!suspensa.current?.contains(e.target as Node)) setVerSub(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setVerSub(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [verSub])

  useEffect(() => {
    if (!id) return
    let vivo = true
    setCarregando(true)
    setTudo(false)
    setVerSub(false)
    unidadesApi.ver(id)
      .then((d) => vivo && setU(d))
      .catch(() => vivo && setU(null))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [id])

  useEffect(() => {
    if (u) document.title = `${u.sigla ?? u.nome} · Rede ATPS`
    return () => { document.title = 'Rede ATPS' }
  }, [u])

  if (carregando) {
    return (
      <>
        <div className={perfil.hero} />
        <div className={perfil.carregando} data-barra-limite><Spinner size="lg" /></div>
      </>
    )
  }

  if (!u) {
    return (
      <>
        <div className={perfil.hero} />
        <main className={perfil.perfil}>
          <article className={perfil.ficha} data-barra-limite>
            <div className={perfil.naoEncontrado}>
              <h1>Unidade não encontrada</h1>
              <p>Ela pode ter sido extinta ou renomeada na estrutura oficial do Governo Federal.</p>
              <Link className={[perfil.acao, perfil.primaria].join(' ')} to="/unidades">Ver órgãos e unidades</Link>
            </div>
          </article>
        </main>
      </>
    )
  }

  const orgao = u.caminho[0] ?? u
  const competencia = u.competencia ?? ''
  const longa = competencia.length > COMPETENCIA_CURTA
  const contato = u.contato
  const temContato = !!(contato && (contato.telefones.length || contato.emails.length || contato.sites.length)) || !!u.endereco

  return (
    <>
      <div className={perfil.hero} style={{ background: gradienteOrgao(orgao.sigla ?? orgao.nome) }} />
      <div className={perfil.perfil}>
        <article className={[perfil.ficha, styles.ficha].join(' ')} data-barra-limite>
          <header className={styles.topo}>
            {u.caminho.length > 0 && (
              <nav aria-label="Onde fica" className={styles.trilha}>
                {u.caminho.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && <IconChevronRight size={14} aria-hidden />}
                    <Link to={`/unidades/${c.id}`} title={c.nome}>{c.sigla ?? c.nome}</Link>
                  </span>
                ))}
              </nav>
            )}
            <span className={styles.nivel}>{NIVEL[u.nivel] ?? 'Unidade'}{u.sigla ? ` · ${u.sigla}` : ''}</span>
            <h1>{u.nome}</h1>
            <p className={styles.resumo}>
              <IconUsers size={18} aria-hidden />
              {u.membros_total === 0
                ? 'Ninguém da Rede informou estar aqui ainda.'
                : u.membros_total === u.membros_aqui
                  ? `${u.membros_total} ${u.membros_total === 1 ? 'pessoa' : 'pessoas'} da Rede`
                  : `${u.membros_total} ${u.membros_total === 1 ? 'pessoa' : 'pessoas'} da Rede, ${u.membros_aqui} diretamente aqui`}
            </p>
          </header>

          <div className={styles.colunas}>
            <div>
              {competencia && (
                <section className={styles.bloco}>
                  <h2><IconBuilding size={16} aria-hidden />O que faz</h2>
                  <div className={styles.competencia}>
                    {emItens(longa && !tudo ? `${competencia.slice(0, COMPETENCIA_CURTA).trimEnd()}…` : competencia)
                      .map((linha, i) => <p key={i}>{linha}</p>)}
                  </div>
                  {longa && (
                    <button type="button" className={styles.verMais} onClick={() => setTudo((v) => !v)} aria-expanded={tudo}>
                      {tudo ? 'Mostrar menos' : 'Ler todas as competências'}
                    </button>
                  )}
                  <p className={styles.fonte}>Competências oficiais, conforme a estrutura regimental (SIORG).</p>
                </section>
              )}

              {u.temas.length > 0 && (
                <section className={styles.bloco}>
                  <h2><IconBriefcase size={16} aria-hidden />Temas de quem está aqui</h2>
                  <div className={styles.temas}>
                    {u.temas.map((t) => (
                      <Link key={t.tema} to={`/busca?tema=${encodeURIComponent(t.tema)}`}>
                        {t.tema}{t.total > 1 && <small>{t.total}</small>}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside>
              {temContato && (
                <section className={styles.bloco}>
                  <h2><IconPhone size={16} aria-hidden />Contato institucional</h2>
                  <ul className={styles.contato}>
                    {contato?.telefones.map((t) => <li key={t}><IconPhone size={16} aria-hidden /><a href={`tel:${t.replace(/[^\d+]/g, '')}`}>{t}</a></li>)}
                    {contato?.emails.map((e) => <li key={e}><IconAt size={16} aria-hidden /><a href={`mailto:${e}`}>{e}</a></li>)}
                    {contato?.sites.map((s) => (
                      <li key={s}><IconWorld size={16} aria-hidden />
                        <a href={s.startsWith('http') ? s : `https://${s}`} target="_blank" rel="noopener noreferrer">{s.replace(/^https?:\/\//, '')}</a>
                      </li>
                    ))}
                    {u.endereco && <li><IconMapPin size={16} aria-hidden /><span>{u.endereco}</span></li>}
                  </ul>
                </section>
              )}

              {u.subunidades.length > 0 && (
                <section className={styles.bloco}>
                  <h2><IconChevronRight size={16} aria-hidden />Unidades</h2>
                  <div className={styles.suspensa} ref={suspensa}>
                  <button type="button" className={styles.suspensaBotao} onClick={() => setVerSub((v) => !v)}
                    aria-expanded={verSub} aria-controls="lista-subunidades">
                    Ver as {u.subunidades.length} unidades <IconChevronDown size={16} aria-hidden />
                  </button>
                  <ul className={[styles.subunidades, styles.suspensaLista].join(' ')} id="lista-subunidades" hidden={!verSub}>
                    {u.subunidades.map((s) => (
                      <li key={s.id}>
                        <Link to={`/unidades/${s.id}`}>
                          <span><b>{s.sigla ?? s.nome}</b>{s.sigla && <small>{s.nome}</small>}</span>
                          {s.membros > 0 && <em aria-label={`${s.membros} da Rede`}>{s.membros}</em>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  </div>
                </section>
              )}
            </aside>
          </div>

          {u.membros.length > 0 && (
            <section className={styles.pessoas} aria-labelledby="titulo-pessoas">
              <h2 id="titulo-pessoas"><IconUsers size={16} aria-hidden />Quem está aqui</h2>
              <div className={busca.linhas}>{u.membros.map((a) => <AnalistaLinha key={a.id} a={a} />)}</div>
              {u.membros_total > u.membros.length && (
                <p className={styles.fonte}>Mostrando {u.membros.length} de {u.membros_total}. Use a busca para filtrar.</p>
              )}
            </section>
          )}
        </article>
      </div>
    </>
  )
}
