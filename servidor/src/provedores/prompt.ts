import type { Estilo } from '../estilos/catalogo.js'

const INSTRUCAO_FIXA =
  "Keep the person's face, identity, expression, pose and the composition of the photo clearly recognizable. Output only the artwork: no frame, no text, no signature."
const INSTRUCAO_REFERENCIA =
  'The second image is a reference artwork: use it only as a style reference, do not copy its content.'

export function montarPrompt(estilo: Estilo, comReferencia: boolean): string {
  return [estilo.prompt, INSTRUCAO_FIXA, ...(comReferencia ? [INSTRUCAO_REFERENCIA] : [])].join(' ')
}
