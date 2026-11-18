// Regras dos links do perfil — as mesmas do backend (backend/schemas.py).

function hostDe(value: string, protocolos: string[]): string | null {
  try {
    const url = new URL(value)
    return protocolos.includes(url.protocol) ? url.hostname.toLowerCase() : null
  } catch {
    return null
  }
}

const doDominio = (host: string | null, dominio: string) =>
  !!host && (host === dominio || host.endsWith(`.${dominio}`))

/** Currículo SouGov: só links https de domínios do governo (*.gov.br). */
export function isLinkGovBr(value: string): boolean {
  return doDominio(hostDe(value, ['https:']), 'gov.br')
}

/** LinkedIn: só links https de linkedin.com. */
export function isLinkLinkedin(value: string): boolean {
  return doDominio(hostDe(value, ['https:']), 'linkedin.com')
}

/** Currículo Lattes: links de lattes.cnpq.br (o próprio CNPq ainda divulga http://). */
export function isLinkLattes(value: string): boolean {
  return doDominio(hostDe(value, ['https:', 'http:']), 'lattes.cnpq.br')
}
