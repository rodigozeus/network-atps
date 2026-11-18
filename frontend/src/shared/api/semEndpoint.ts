import axios from 'axios'

/**
 * Indica que o back-end ainda não tem o endpoint (404/405/501).
 * Usado pelos recursos do novo visual que dependem de endpoints novos,
 * para a interface continuar funcionando até eles existirem.
 */
export function semEndpoint(err: unknown): boolean {
  return axios.isAxiosError(err) && [404, 405, 501].includes(err.response?.status ?? 0)
}
