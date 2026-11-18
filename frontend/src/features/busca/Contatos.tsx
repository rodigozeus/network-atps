import type { ReactNode } from 'react'
import { IconAt, IconBrandWhatsapp, IconMail, IconPhone } from '@tabler/icons-react'
import type { AnalistaPublico } from '@shared/api/types'
import { formatPhone } from '@shared/utils/phone'
import { telLink } from '@shared/utils/analista'

/**
 * Botões de contato. A API já esconde e-mail pessoal e celular de quem não autorizou;
 * sem celular, o botão de ligar usa o telefone institucional.
 */
export default function Contatos({ a, envolver, tamanho }: {
  a: AnalistaPublico
  /** como cada ícone é embrulhado (o card usa um círculo grande; a linha, o próprio link) */
  envolver?: (icone: ReactNode) => ReactNode
  tamanho: number
}) {
  const embrulhar = envolver ?? ((i: ReactNode) => i)
  const tel = a.celular || a.telefone_institucional
  return (
    <>
      {tel && (
        <a href={`tel:${telLink(tel)}`} title={formatPhone(tel)} aria-label="Ligar">
          {embrulhar(<IconPhone size={tamanho} aria-hidden />)}
        </a>
      )}
      {a.email_institucional && (
        <a href={`mailto:${a.email_institucional}`} title={`${a.email_institucional} (institucional)`} aria-label="E-mail institucional">
          {embrulhar(<IconMail size={tamanho} aria-hidden />)}
        </a>
      )}
      {a.email_pessoal && (
        <a href={`mailto:${a.email_pessoal}`} title={`${a.email_pessoal} (pessoal)`} aria-label="E-mail pessoal">
          {embrulhar(<IconAt size={tamanho} aria-hidden />)}
        </a>
      )}
      {a.celular && (
        <a href={`https://wa.me/${telLink(a.celular).slice(1)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp">
          {embrulhar(<IconBrandWhatsapp size={tamanho} aria-hidden />)}
        </a>
      )}
    </>
  )
}
