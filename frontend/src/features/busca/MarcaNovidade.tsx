import { useId } from 'react'
import { IconSparkles } from '@tabler/icons-react'
import { useFavoritos } from '@shared/hooks/useFavoritos'
import { dataEvento, rotuloEvento } from '@shared/utils/novidades'
import styles from './busca.module.css'

/** Selo "Novidade" num favorito que mudou de lotação, tema ou formação desde a última visita.
 *  Passando o mouse (ou focando pelo teclado), abre a lista do que mudou. */
export default function MarcaNovidade({ id, className }: { id: number; className: string }) {
  const { novidadesDe } = useFavoritos()
  const dicaId = useId()
  const eventos = novidadesDe(id)
  if (!eventos?.length) return null
  return (
    <span className={className} tabIndex={0} aria-describedby={dicaId}>
      <span className={styles.pulso} aria-hidden />
      <IconSparkles size={15} aria-hidden />
      Novidade
      <span role="tooltip" id={dicaId} className={styles.novidadeDica}>
        <strong>Desde a sua última visita</strong>
        {eventos.map((e, i) => (
          <span key={i} className={styles.novidadeItem}>
            <b>{rotuloEvento(e)}</b> {e.descricao} <small>{dataEvento(e)}</small>
          </span>
        ))}
      </span>
    </span>
  )
}
