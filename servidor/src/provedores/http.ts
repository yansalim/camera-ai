import { ErroTemporario } from './tipos.js'

const LOGIN_EXPIRADO = /default credentials|invalid_grant|invalid_rapt|reauth/i

/** Erro do login OAuth do Google (arquivo ausente, login expirado ou revogado), que acontece antes de qualquer pedido HTTP. */
export function erroDeLogin(mensagem: string): Error | undefined {
  return LOGIN_EXPIRADO.test(mensagem) ? new Error(`Credenciais do Google inválidas ou expiradas: refaça o login OAuth (${mensagem})`) : undefined
}

/** Converte o status HTTP de uma falha do provedor no erro certo (temporário ou definitivo). */
export function classificarStatus(status: number, mensagem: string): Error {
  if (status === 408 || status === 429 || status >= 500) return new ErroTemporario(`HTTP ${status}: ${mensagem}`)
  if (status === 401 || status === 403) {
    return new Error(`Credenciais do Google inválidas ou expiradas: refaça o login OAuth (HTTP ${status}: ${mensagem})`)
  }
  return new Error(`HTTP ${status}: ${mensagem}`)
}
