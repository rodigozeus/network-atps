import { useRef, useState } from 'react'
import { IconStar, IconStarFilled } from '@tabler/icons-react'
import { useFavoritos } from '@shared/hooks/useFavoritos'

/** Estrela de favoritar; mostra um aviso curto ao lado quando muda */
export default function BotaoFavorito({ id, className, classeAviso, tamanho = 18 }: {
  id: number
  className: string
  classeAviso?: string
  tamanho?: number
}) {
  const { ehFavorito, alternar } = useFavoritos()
  const [aviso, setAviso] = useState('')
  const [pulo, setPulo] = useState(0)
  const timer = useRef<number>()
  const on = ehFavorito(id)
  const texto = on ? 'Remover dos favoritos' : 'Favoritar perfil'

  const clicar = async () => {
    try {
      const agora = await alternar(id)
      setAviso(agora ? 'Adicionado aos favoritos' : 'Removido dos favoritos')
    } catch {
      setAviso('Não foi possível salvar. Tente de novo.')
    }
    setPulo((p) => p + 1)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setAviso(''), 1600)
  }

  return (
    <>
      {classeAviso && (
        <span className={classeAviso} data-show={aviso ? 'true' : 'false'} aria-live="polite">{aviso}</span>
      )}
      <button type="button" className={className} aria-pressed={on} aria-label={texto} title={texto} onClick={clicar} data-pulo={pulo % 2}>
        {on ? <IconStarFilled size={tamanho} aria-hidden /> : <IconStar size={tamanho} aria-hidden />}
      </button>
    </>
  )
}
