import sharp from 'sharp'
import type { Estilo } from '../src/estilos/catalogo.js'

export const estiloDeTeste: Estilo = {
  id: 'teste',
  nome: 'Teste',
  legenda: 'Legenda',
  prompt: 'Repaint this photo in a test style.',
  frases: ['Pintando…'],
  ordem: 1,
  ativo: true,
  caminhoMiniatura: '/nao/existe/miniatura.jpg',
}

/** JPEG colorido (gradiente) com as dimensões pedidas. */
export async function gerarJpeg(largura: number, altura: number): Promise<Buffer> {
  const pixels = Buffer.alloc(largura * altura * 3)
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = (y * largura + x) * 3
      pixels[i] = (x * 255) / largura
      pixels[i + 1] = (y * 255) / altura
      pixels[i + 2] = 128
    }
  }
  return sharp(pixels, { raw: { width: largura, height: altura, channels: 3 } }).jpeg().toBuffer()
}
