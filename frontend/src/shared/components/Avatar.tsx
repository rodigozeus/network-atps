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

// Até este diâmetro, a miniatura de 240 px basta (mesmo em tela 2x)
const LIMITE_MINIATURA = 120

/** Foto de perfil redonda; sem foto (ou se a imagem falhar), mostra as iniciais sobre um gradiente.
 *  Avatares pequenos usam a miniatura; se ela faltar, cai na foto normal. */
export default function Avatar({ id, nome, fotoPath, tamanho, className, alt = '' }: AvatarProps) {
  const pequeno = tamanho <= LIMITE_MINIATURA
  const [tentativa, setTentativa] = useState(0) // 0: preferida, 1: foto normal, 2: falhou
  const falhou = tentativa >= 2 || (!pequeno && tentativa >= 1)
  const url = pequeno && tentativa === 0 ? miniaturaUrl(fotoPath) : fotoUrl(fotoPath)
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
