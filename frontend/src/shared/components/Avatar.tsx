import { useState, type CSSProperties } from 'react'
import { estiloPaleta, fotoUrl, iniciais } from '@shared/utils/analista'
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

/** Foto de perfil redonda; sem foto (ou se a imagem falhar), mostra as iniciais sobre um gradiente */
export default function Avatar({ id, nome, fotoPath, tamanho, className, alt = '' }: AvatarProps) {
  const [falhou, setFalhou] = useState(false)
  const url = fotoUrl(fotoPath)
  const estilo = { ...estiloPaleta(id), '--tam': `${tamanho}px` } as CSSProperties
  return (
    <span className={[styles.avatar, className ?? ''].filter(Boolean).join(' ')} style={estilo}>
      {url && !falhou ? (
        <img src={url} alt={alt} onError={() => setFalhou(true)} draggable={false} />
      ) : (
        <span aria-hidden={alt ? undefined : true}>{iniciais(nome)}</span>
      )}
    </span>
  )
}
