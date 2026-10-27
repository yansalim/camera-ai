import type { Estilo } from '../estilos/catalogo.js'

export interface Provedor {
  readonly nome: string
  readonly modelo: string
  /** Recebe a foto (JPEG) e devolve a imagem pintada no estilo. */
  pintar(foto: Buffer, estilo: Estilo): Promise<Buffer>
}

/** O provedor recusou a imagem (filtro de conteúdo). Não adianta repetir. */
export class ErroRecusa extends Error {
  override name = 'ErroRecusa'
}

/** Falha passageira (rede, 429, 5xx). Vale uma nova tentativa. */
export class ErroTemporario extends Error {
  override name = 'ErroTemporario'
}
