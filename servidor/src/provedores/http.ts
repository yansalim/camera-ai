import { ErroTemporario } from './tipos.js'

/** Converte o status HTTP de uma falha do provedor no erro certo (temporário ou definitivo). */
export function classificarStatus(status: number, mensagem: string): Error {
  if (status === 408 || status === 429 || status >= 500) return new ErroTemporario(`HTTP ${status}: ${mensagem}`)
  if (status === 401 || status === 403) {
    return new Error(`Credenciais do Google inválidas ou expiradas: refaça o login OAuth (HTTP ${status}: ${mensagem})`)
  }
  return new Error(`HTTP ${status}: ${mensagem}`)
}
