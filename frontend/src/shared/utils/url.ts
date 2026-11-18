/** Aceita apenas links https de domínios do governo (*.gov.br) — mesma regra do backend. */
export function isLinkGovBr(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && (host === 'gov.br' || host.endsWith('.gov.br'))
  } catch {
    return false
  }
}
