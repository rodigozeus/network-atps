import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/** Ao abrir uma página nova (clique ou link), começa do topo. No "voltar" (POP), deixa o
 *  navegador devolver a posição anterior, para quem volta à busca não perder o lugar. */
export default function RolarParaTopo() {
  const { pathname } = useLocation()
  const tipo = useNavigationType()
  useEffect(() => {
    if (tipo !== 'POP') window.scrollTo(0, 0)
  }, [pathname, tipo])
  return null
}
