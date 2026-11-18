import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconChevronDown, IconLogout, IconPencil, IconShieldCog, IconUser } from '@tabler/icons-react'
import { useAuth } from '@shared/hooks/useAuth'
import { limparFavoritos } from '@shared/hooks/useFavoritos'
import { nomeCurto } from '@shared/utils/analista'
import Avatar from './Avatar'
import styles from './Barra.module.css'

/** Foto e nome de quem está logado; ao clicar abre Ver perfil, Editar perfil e Sair */
export default function MenuConta() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false)
        botao.current?.focus()
      }
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  if (!user) return null

  const itens = () => [...(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
  const navegarSetas = (e: KeyboardEvent) => {
    const lista = itens()
    const i = lista.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      lista[(i + 1) % lista.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      lista[(i - 1 + lista.length) % lista.length]?.focus()
    }
  }

  const sair = () => {
    setAberto(false)
    limparFavoritos()
    void logout().catch(() => {}).then(() => navigate('/login?saiu=1', { replace: true }))
  }

  const podeAdministrar = user.role === 'admin' || user.role === 'andeps'

  return (
    <div className={[styles.usuario, aberto ? styles.aberto : ''].join(' ')} ref={raiz}>
      <button
        ref={botao}
        type="button"
        className={styles.usuarioBtn}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={menuId}
        aria-label={`Conta de ${user.nome}`}
        onClick={() => setAberto((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setAberto(true)
            requestAnimationFrame(() => itens()[0]?.focus())
          }
        }}
      >
        <Avatar id={user.id} nome={user.nome} fotoPath={user.foto_path} tamanho={38} className={styles.usuarioFoto} />
        <span className={styles.usuarioNome}>{nomeCurto(user.nome)}</span>
        <IconChevronDown size={16} className={styles.seta} aria-hidden />
      </button>

      <div className={styles.menu} id={menuId} role="menu" onKeyDown={navegarSetas} onClick={(e) => {
        if ((e.target as HTMLElement).closest('a')) setAberto(false)
      }}>
        <div className={styles.menuTopo}>
          <strong>{user.nome}</strong>
          <span>{user.email_institucional || user.email_pessoal}</span>
        </div>
        <Link to={`/analistas/${user.id}`} role="menuitem"><IconUser size={18} aria-hidden />Ver perfil</Link>
        <Link to="/perfil" role="menuitem"><IconPencil size={18} aria-hidden />Editar perfil</Link>
        {podeAdministrar && (
          <Link to="/admin" role="menuitem"><IconShieldCog size={18} aria-hidden />Painel de administração</Link>
        )}
        <hr />
        <button type="button" role="menuitem" className={styles.sair} onClick={sair}>
          <IconLogout size={18} aria-hidden />Sair
        </button>
      </div>
    </div>
  )
}
