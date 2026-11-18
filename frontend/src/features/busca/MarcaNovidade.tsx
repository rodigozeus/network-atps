import { IconSparkles } from '@tabler/icons-react'
import { useFavoritos } from '@shared/hooks/useFavoritos'
import { textoEvento } from '@shared/utils/novidades'

/** Selo "Novidade" num favorito que mudou de lotação, tema ou formação desde a última visita */
export default function MarcaNovidade({ id, className }: { id: number; className: string }) {
  const { novidadesDe } = useFavoritos()
  const eventos = novidadesDe(id)
  if (!eventos?.length) return null
  const resumo = eventos.map(textoEvento).join('\n')
  return (
    <span className={className} title={resumo}>
      <IconSparkles size={14} aria-hidden />
      Novidade
      <span className="sr-only">: {resumo}</span>
    </span>
  )
}
