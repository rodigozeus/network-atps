import { useState, type CSSProperties } from 'react'
import { estiloPaleta, fotoUrl, iniciais, miniaturaUrl } from '@shared/utils/analista'
import styles from './Avatar.module.css'

interface AvatarProps {
  id: number
  nome: string
  fotoPath: string | null
  /** diâmetro em px */
  tamanho: number
  className?: string
  /** texto alternativo; vazio quando o nome já aparece ao lado */
  alt?: string
}

// Até 120 px de diâmetro, a de 240 px basta (mesmo em tela 2x); acima, a de 480 px
const LIMITE_MINIATURA = 120

/** Foto de perfil redonda; sem foto (ou se a imagem falhar), mostra as iniciais sobre um gradiente.
 *  Usa a versão menor adequada ao tamanho; se ela faltar, cai na foto completa. */
export default function Avatar({ id, nome, fotoPath, tamanho, className, alt = '' }: AvatarProps) {
  const [tentativa, setTentativa] = useState(0) // 0: versão menor, 1: foto completa, 2: falhou
  const falhou = tentativa >= 2
  const url = tentativa === 0 ? miniaturaUrl(fotoPath, tamanho <= LIMITE_MINIATURA ? 'p' : 'm') : fotoUrl(fotoPath)
  const estilo = { ...estiloPaleta(id), '--tam': `${tamanho}px` } as CSSProperties
  return (
    <span className={[styles.avatar, className ?? ''].filter(Boolean).join(' ')} style={estilo}>
      {url && !falhou ? (
        <img src={url} alt={alt} onError={() => setTentativa((t) => t + 1)} draggable={false} />
      ) : (
        <span aria-hidden={alt ? undefined : true}>{iniciais(nome)}</span>
      )}
    </span>
  )
}
