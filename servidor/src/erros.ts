export type CodigoErro =
  | 'EVENTO_INATIVO'
  | 'LIMITE_APARELHO'
  | 'LIMITE_IP'
  | 'TETO_DIARIO'
  | 'FOTO_INVALIDA'
  | 'ESTILO_INVALIDO'
  | 'ACEITE_AUSENTE'
  | 'RECUSADA'
  | 'IA_INDISPONIVEL'
  | 'TEMPO_ESGOTADO'

const CALMA = 'Calma, artista! Espere alguns minutinhos para pintar de novo.'

/** Seção 7 da spec, mais ACEITE_AUSENTE (Decisão 2 do plano). */
export const ERROS: Record<CodigoErro, { status: number; mensagem: string }> = {
  EVENTO_INATIVO: { status: 503, mensagem: 'Esta experiência está disponível no estande.' },
  LIMITE_APARELHO: { status: 429, mensagem: CALMA },
  LIMITE_IP: { status: 429, mensagem: CALMA },
  TETO_DIARIO: { status: 429, mensagem: 'A pintora foi descansar. Volte amanhã!' },
  FOTO_INVALIDA: { status: 400, mensagem: 'Não consegui abrir essa foto. Tente tirar outra.' },
  ESTILO_INVALIDO: { status: 400, mensagem: 'Esse estilo não está disponível. Escolha outro.' },
  ACEITE_AUSENTE: { status: 400, mensagem: 'Volte ao início e toque em "Quero criar minha foto".' },
  RECUSADA: { status: 422, mensagem: 'Não consegui pintar essa foto. Que tal tentar outra?' },
  IA_INDISPONIVEL: { status: 502, mensagem: 'A pintora está com dificuldades. Tente de novo.' },
  TEMPO_ESGOTADO: { status: 504, mensagem: 'Demorou mais que o normal. Tente de novo.' },
}

/** Erro que vira resposta JSON { erro, mensagem } com o status da tabela. */
export class ErroApi extends Error {
  override name = 'ErroApi'
  constructor(public readonly codigo: CodigoErro) {
    super(ERROS[codigo].mensagem)
  }
}

export const corpoDoErro = (codigo: CodigoErro) => ({ erro: codigo, mensagem: ERROS[codigo].mensagem })
