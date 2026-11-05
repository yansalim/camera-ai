import type { Estilo } from '../estilos/catalogo.js'

// Textos revisados em docs/proposta-prompts.md e testados em 2026-11-05 (docs/decisoes.md).
// Os modelos de imagem Gemini seguem instruções em linguagem natural: frases completas, positivas,
// dizendo o que muda e o que fica igual.

/** Identidade, enquadramento, decoro e regras de saída; vale para todos os estilos. */
const INSTRUCAO_FIXA =
  "This is a portrait of a real visitor at a school art exhibition, and they must instantly recognize themselves. Keep each person's identity exactly the same as in the photo: face shape, eyes, eyebrows, nose, mouth, skin tone, apparent age, gender presentation, hairstyle and hair colour, facial hair, glasses and any distinctive marks, with their own expression. Keep the same number of people in the same positions and poses, and the photo's framing and crop, so every face stays as large in the frame as in the photo. Hijabs, caps and hats stay on, rendered in the same medium. Everyone stays fully and modestly clothed, and the result is flattering and respectful. Every part of the image, people included, is genuinely re-made in the medium described, with no photographic texture left. The artwork fills the whole image edge to edge as a plain unsigned surface: no frame, border, lettering or signature."

/** Só quando o estilo envia a obra como referência: o modelo tende a copiar pose e roupa dela. */
const INSTRUCAO_REFERENCIA =
  'Image 2 is a small crop of the original artwork, given only as a sample of its colour palette, brushwork and surface texture. Take nothing else from it: pose, hands, body, face, hair, clothing and background all come from Image 1 and the description above.'

/** Rótulos enviados como texto logo antes de cada imagem do pedido. */
export const ROTULO_FOTO = "Image 1: the visitor's photo."
export const ROTULO_REFERENCIA = 'Image 2: style sample only.'

export function montarPrompt(estilo: Estilo, comReferencia: boolean): string {
  return [estilo.prompt, INSTRUCAO_FIXA, ...(comReferencia ? [INSTRUCAO_REFERENCIA] : [])].join(' ')
}
