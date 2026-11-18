import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  IconAddressBook, IconAffiliate, IconAlertTriangle, IconAt, IconBrandLinkedin, IconBrandWhatsapp, IconBriefcase, IconBuilding,
  IconBuildingCommunity, IconCertificate, IconCircleCheck, IconFileCv, IconMail, IconPencil, IconPhone, IconSchool, IconSparkles, IconStar,
  IconStarFilled, IconTrash,
} from '@tabler/icons-react'
import type { AnalistaPublico, EventoPerfil } from '@shared/api/types'
import { buscaApi } from '@shared/api/busca'
import { perfilApi } from '@shared/api/perfil'
import { Avatar, Spinner } from '@shared/components'
import { useAuth } from '@shared/hooks/useAuth'
import { useFavoritos, limparFavoritos } from '@shared/hooks/useFavoritos'
import { formatPhone } from '@shared/utils/phone'
import { NIVEIS, TURMAS, gradienteOrgao, lotacao, ordenarFormacoes, telLink } from '@shared/utils/analista'
import styles from './perfil.module.css'
import { isLinkGovBr, isLinkLattes, isLinkLinkedin } from '@shared/utils/url'
import { dataEvento, rotuloEvento } from '@shared/utils/novidades'

interface Proximo {
  p: AnalistaPublico
  comuns: string[]
}

/** Perfil completo de uma pessoa, sem abreviações. No próprio perfil: editar e excluir. */
export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { ehFavorito, alternar, novidadesDe, marcarVisto } = useFavoritos()
  const [perfil, setPerfil] = useState<AnalistaPublico | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [proximos, setProximos] = useState<Proximo[]>([])
  const [aviso, setAviso] = useState(false)
  // Novidades guardadas ao abrir: continuam na tela depois de marcadas como vistas
  const [novidades, setNovidades] = useState<EventoPerfil[]>([])

  const proprio = !!user && String(user.id) === id

  useEffect(() => {
    if (!id) return
    setCarregando(true)
    perfilApi.getAnalista(id)
      .then(setPerfil)
      .catch(() => setPerfil(null))
      .finally(() => setCarregando(false))
  }, [id])

  const eventosNovos = perfil ? novidadesDe(perfil.id) : undefined
  useEffect(() => {
    if (!perfil || !eventosNovos?.length) return
    setNovidades(eventosNovos)
    marcarVisto(perfil.id)
  }, [perfil, eventosNovos, marcarVisto])
  useEffect(() => { setNovidades([]) }, [id])

  useEffect(() => {
    if (perfil) document.title = `${perfil.nome} · Rede ATPS`
    return () => { document.title = 'Rede ATPS' }
  }, [perfil])

  // Pessoas próximas: temas em comum pesam mais que o mesmo ministério
  useEffect(() => {
    if (!perfil) return
    const temas = [...perfil.temas].sort((a, b) => Number(b.em_exercicio_atual) - Number(a.em_exercicio_atual)).slice(0, 3)
    const buscas = [
      ...temas.map((t) => buscaApi.buscar({ tema: t.tema, page_size: 12 })),
      ...(perfil.ministerio ? [buscaApi.buscar({ ministerio: perfil.ministerio, page_size: 12 })] : []),
    ]
    Promise.allSettled(buscas).then((res) => {
      const vistos = new Map<number, AnalistaPublico>()
      res.forEach((r) => r.status === 'fulfilled' && r.value.items.forEach((p) => p.id !== perfil.id && vistos.set(p.id, p)))
      const meus = perfil.temas.map((t) => t.tema.toLowerCase())
      setProximos([...vistos.values()]
        .map((p) => {
          const comuns = p.temas.filter((t) => meus.includes(t.tema.toLowerCase())).map((t) => t.tema)
          return { p, comuns, pontos: comuns.length * 2 + (p.ministerio && p.ministerio === perfil.ministerio ? 1 : 0) }
        })
        .filter((x) => x.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 4))
    })
  }, [perfil])

  // Volta da edição com ?salvo=1: avisa e limpa o parâmetro
  useEffect(() => {
    if (!params.has('salvo')) return
    setAviso(true)
    setParams({}, { replace: true })
    const t = window.setTimeout(() => setAviso(false), 2600)
    return () => window.clearTimeout(t)
  }, [params, setParams])

  if (carregando) {
    return (
      <>
        <div className={styles.hero} />
        <div className={styles.carregando} data-barra-limite><Spinner size="lg" /></div>
      </>
    )
  }

  if (!perfil) {
    return (
      <>
        <div className={styles.hero} />
        <main className={styles.perfil}>
          <article className={styles.ficha} data-barra-limite>
            <div className={styles.naoEncontrado}>
              <h1>Perfil não encontrado</h1>
              <p>O endereço pode estar incompleto ou a pessoa não faz mais parte da rede.</p>
              <Link className={[styles.acao, styles.primaria].join(' ')} to="/busca">Ver todas as pessoas</Link>
            </div>
          </article>
        </main>
      </>
    )
  }

  const nivelLotacao = lotacao(perfil)
  const tel = perfil.celular
  const favorito = ehFavorito(perfil.id)
  const temasAtuais = perfil.temas.filter((t) => t.em_exercicio_atual)
  const temasAnteriores = perfil.temas.filter((t) => !t.em_exercicio_atual)
  const emailContato = perfil.email_institucional || perfil.email_pessoal

  return (
    <>
      <div className={styles.hero} style={{ background: gradienteOrgao(perfil.ministerio_sigla ?? perfil.ministerio) }} />
      <div className={styles.perfil}>
        <article className={styles.ficha} data-barra-limite>
          <div className={styles.fichaTopo}>
            <Avatar id={perfil.id} nome={perfil.nome} fotoPath={perfil.foto_path} tamanho={200} className={styles.avatar} alt={`Foto de ${perfil.nome}`} />
            <div className={styles.ident}>
              {perfil.ministerio && <span className={styles.orgTag}>{perfil.ministerio}</span>}
              <h1>{perfil.nome}</h1>
              {(perfil.cargo_fce || perfil.turma) && (
                <p className={styles.cargo}>
                  {perfil.cargo_fce}
                  {perfil.turma && <span className={styles.turma}>{perfil.cargo_fce ? ' · ' : ''}{TURMAS[perfil.turma]}</span>}
                </p>
              )}
            </div>
            <div className={styles.fichaAcoes}>
              {proprio ? (
                <Link className={[styles.acao, styles.primaria].join(' ')} to="/perfil"><IconPencil size={19} aria-hidden />Editar perfil</Link>
              ) : (
                <>
                  {emailContato && <a className={[styles.acao, styles.primaria].join(' ')} href={`mailto:${emailContato}`}><IconMail size={19} aria-hidden />Enviar e-mail</a>}
                  {tel && <a className={styles.acao} href={`https://wa.me/${telLink(tel).slice(1)}`} target="_blank" rel="noopener noreferrer"><IconBrandWhatsapp size={19} aria-hidden />WhatsApp</a>}
                  <button type="button" className={[styles.acao, favorito ? styles.favoritado : ''].join(' ')} aria-pressed={favorito}
                    onClick={() => { void alternar(perfil.id).catch(() => {}) }}>
                    {favorito ? <IconStarFilled size={19} aria-hidden /> : <IconStar size={19} aria-hidden />}
                    {favorito ? 'Nos favoritos' : 'Favoritar'}
                  </button>
                </>
              )}
            </div>
          </div>

          {novidades.length > 0 && (
            <section className={styles.novidades} aria-labelledby="titulo-novidades">
              <h2 id="titulo-novidades"><IconSparkles size={18} aria-hidden />Novidades desde a sua última visita</h2>
              <ul>
                {novidades.map((e, i) => (
                  <li key={i}>
                    <span className={styles.novidadeTipo}>{rotuloEvento(e)}</span>
                    <span>{e.descricao}</span>
                    <time dateTime={e.criado_em}>{dataEvento(e)}</time>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className={styles.colunas}>
            <div>
              <section className={styles.bloco}>
                <h2 className={styles.blocoTitulo}><span className={[styles.ico, styles.icoLot].join(' ')}><IconBuilding size={16} aria-hidden /></span>Lotação</h2>
                {nivelLotacao.length ? (
                  <ol className={styles.lotacao}>
                    {nivelLotacao.map((n, i) => (
                      <li key={i}><strong>{n.nome ?? n.sigla}</strong>{n.nome && n.sigla && <span>{n.sigla}</span>}</li>
                    ))}
                  </ol>
                ) : <p className={styles.vazio}>Lotação não informada.</p>}
              </section>

              <section className={styles.bloco}>
                <h2 className={styles.blocoTitulo}><span className={[styles.ico, styles.icoEdu].join(' ')}><IconSchool size={16} aria-hidden /></span>Formação acadêmica</h2>
                {perfil.formacoes.length ? (
                  <ul className={styles.formacoes}>
                    {ordenarFormacoes(perfil.formacoes).map((f) => (
                      <li key={f.id}>
                        <span className={styles.nivel}>{NIVEIS[f.nivel]}</span>
                        <strong>{f.curso}</strong>
                        <span className={styles.inst}>{f.instituicao}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className={styles.vazio}>Nenhuma formação informada.</p>}
              </section>

              <section className={styles.bloco}>
                <h2 className={styles.blocoTitulo}><span className={[styles.ico, styles.icoTema].join(' ')}><IconBriefcase size={16} aria-hidden /></span>Temas de atuação</h2>
                {perfil.temas.length ? (
                  <>
                    {temasAtuais.length > 0 && (
                      <>
                        {temasAnteriores.length > 0 && <p className={styles.subtitulo}>Em exercício atual</p>}
                        <div className={styles.temas}>{temasAtuais.map((t) => <span key={t.id}>{t.tema}</span>)}</div>
                      </>
                    )}
                    {temasAnteriores.length > 0 && (
                      <>
                        <p className={styles.subtitulo}>Experiência anterior</p>
                        <div className={[styles.temas, styles.anteriores].join(' ')}>{temasAnteriores.map((t) => <span key={t.id}>{t.tema}</span>)}</div>
                      </>
                    )}
                  </>
                ) : <p className={styles.vazio}>Nenhum tema informado.</p>}
              </section>
            </div>

            <aside>
              <section className={styles.bloco}>
                <h2 className={styles.blocoTitulo}><span className={[styles.ico, styles.icoCont].join(' ')}><IconAddressBook size={16} aria-hidden /></span>Contato</h2>
                <Contatos a={perfil} />
              </section>

              {proximos.length > 0 && (
                <section className={styles.bloco}>
                  <h2 className={styles.blocoTitulo}><span className={[styles.ico, styles.icoRede].join(' ')}><IconAffiliate size={16} aria-hidden /></span>Pessoas próximas na rede</h2>
                  <ul className={styles.parecidos}>
                    {proximos.map(({ p, comuns }) => (
                      <li key={p.id}>
                        <Link to={`/analistas/${p.id}`}>
                          <Avatar id={p.id} nome={p.nome} fotoPath={p.foto_path} tamanho={48} />
                          <span>
                            <b>{p.nome}</b>
                            <small>{comuns.length ? `Temas em comum: ${comuns.join(', ')}` : `Também no ${p.ministerio}`}</small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>

          {proprio && <ExcluirPerfil onExcluido={() => { limparFavoritos(); void logout().catch(() => {}).then(() => navigate('/login?excluido=1', { replace: true })) }} />}
        </article>
      </div>

      <div className={[styles.aviso, aviso ? styles.avisoShow : ''].join(' ')} role="status">
        {aviso && <><IconCircleCheck size={18} aria-hidden />Perfil atualizado</>}
      </div>
    </>
  )
}

function Contatos({ a }: { a: AnalistaPublico }) {
  const itens = [
    a.telefone_institucional && { href: `tel:${telLink(a.telefone_institucional)}`, icone: <IconBuildingCommunity size={20} aria-hidden />, rotulo: 'Telefone institucional', valor: formatPhone(a.telefone_institucional) },
    a.celular && { href: `tel:${telLink(a.celular)}`, icone: <IconPhone size={20} aria-hidden />, rotulo: 'Celular', valor: formatPhone(a.celular) },
    a.celular && { href: `https://wa.me/${telLink(a.celular).slice(1)}`, externo: true, icone: <IconBrandWhatsapp size={20} aria-hidden />, rotulo: 'WhatsApp', valor: formatPhone(a.celular) },
    a.email_institucional && { href: `mailto:${a.email_institucional}`, icone: <IconMail size={20} aria-hidden />, rotulo: 'E-mail institucional', valor: a.email_institucional },
    a.email_pessoal && { href: `mailto:${a.email_pessoal}`, icone: <IconAt size={20} aria-hidden />, rotulo: 'E-mail pessoal', valor: a.email_pessoal },
    a.portal_url && isLinkGovBr(a.portal_url) && { href: a.portal_url, externo: true, icone: <IconFileCv size={20} aria-hidden />, rotulo: 'Currículo SouGov.br', valor: 'Abrir currículo' },
    a.lattes_url && isLinkLattes(a.lattes_url) && { href: a.lattes_url, externo: true, icone: <IconCertificate size={20} aria-hidden />, rotulo: 'Currículo Lattes', valor: 'Abrir currículo' },
    a.linkedin_url && isLinkLinkedin(a.linkedin_url) && { href: a.linkedin_url, externo: true, icone: <IconBrandLinkedin size={20} aria-hidden />, rotulo: 'LinkedIn', valor: 'Abrir perfil' },
  ].filter(Boolean) as Array<{ href: string; externo?: boolean; icone: JSX.Element; rotulo: string; valor: string }>

  if (!itens.length) return <p className={styles.vazio}>Nenhum contato público.</p>
  return (
    <ul className={styles.contatos}>
      {itens.map((c) => (
        <li key={c.rotulo}>
          <a href={c.href} {...(c.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {c.icone}
            <span><small>{c.rotulo}</small><b>{c.valor}</b></span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/** Excluir o próprio perfil: pede a senha e confirma antes (exigência da API e da LGPD) */
function ExcluirPerfil({ onExcluido }: { onExcluido: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  const fechar = () => {
    dialogo.current?.close()
    setSenha('')
    setErro('')
    botao.current?.focus()
  }

  const excluir = async () => {
    if (!senha) { setErro('Digite sua senha para confirmar.'); return }
    setExcluindo(true)
    setErro('')
    try {
      await perfilApi.deleteMe(senha)
      onExcluido()
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      setErro(status === 401 ? 'Senha incorreta.' : 'Não foi possível excluir agora. Tente de novo.')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <section className={styles.exclusao}>
      <div>
        <h2>Excluir meu perfil</h2>
        <p>Remove todos os dados do seu perfil da Rede ATPS: foto, lotação, formação, temas e contatos. Seus colegas deixam de encontrar você na busca. Essa ação não pode ser desfeita.</p>
      </div>
      <button ref={botao} type="button" className={[styles.acao, styles.perigo].join(' ')} onClick={() => dialogo.current?.showModal()}>
        <IconTrash size={19} aria-hidden />Excluir meus dados
      </button>

      <dialog ref={dialogo} className={styles.confirmar} aria-labelledby="titulo-excluir" onClose={() => { setSenha(''); setErro('') }}>
        <form method="dialog" onSubmit={(e) => { e.preventDefault(); void excluir() }}>
          <span className={styles.icoAlerta}><IconAlertTriangle size={24} aria-hidden /></span>
          <h2 id="titulo-excluir">Excluir todos os seus dados?</h2>
          <p>Seu perfil será removido da Rede ATPS e não poderá ser recuperado. Isso inclui:</p>
          <ul>
            <li>foto, nome e cargo;</li>
            <li>lotação, formação acadêmica e temas de atuação;</li>
            <li>telefones e e-mails de contato.</li>
          </ul>
          <label className={styles.campoSenha}>
            <span>Digite sua senha para confirmar</span>
            <input type="password" autoComplete="current-password" value={senha} onChange={(e) => { setSenha(e.target.value); setErro('') }}
              aria-invalid={!!erro} aria-describedby={erro ? 'erro-excluir' : undefined} />
          </label>
          {erro && <p className={styles.erro} id="erro-excluir" role="alert">{erro}</p>}
          <div className={styles.confirmarAcoes}>
            <button type="button" className={styles.acao} onClick={fechar} autoFocus>Cancelar</button>
            <button type="submit" className={[styles.acao, styles.perigoCheio].join(' ')} disabled={excluindo}>
              <IconTrash size={19} aria-hidden />{excluindo ? 'Excluindo…' : 'Excluir meus dados'}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  )
}
