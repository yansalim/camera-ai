import { ErroPintura } from './api'

const LADO_MAXIMO = 1600

const fotoInvalida = () => new ErroPintura('FOTO_INVALIDA', 'Não consegui abrir essa foto. Tente tirar outra.')

/** Dimensões com o lado maior limitado a `max`, sem ampliar. */
export function calcularDimensoes(largura: number, altura: number, max = LADO_MAXIMO): { largura: number; altura: number } {
  const escala = Math.min(1, max / Math.max(largura, altura))
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) }
}

/**
 * Abre a imagem num <img>: os navegadores atuais aplicam a orientação EXIF nele
 * (image-orientation: from-image), inclusive o Safari, o que nem todo createImageBitmap faz.
 */
export async function abrirImagem(arquivo: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function canvasParaJpeg(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolver, rejeitar) =>
    canvas.toBlob(b => (b ? resolver(b) : rejeitar(new Error('Falha ao gerar o JPEG'))), 'image/jpeg', qualidade),
  )
}

/** Foto da câmera pronta para enviar: rotação aplicada, lado maior ≤ 1600 px, JPEG 0,85 (sem metadados). */
export async function prepararFoto(arquivo: Blob): Promise<Blob> {
  let img: HTMLImageElement
  try {
    img = await abrirImagem(arquivo)
  } catch {
    throw fotoInvalida()
  }
  const { largura, altura } = calcularDimensoes(img.naturalWidth, img.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  canvas.getContext('2d')!.drawImage(img, 0, 0, largura, altura)
  return canvasParaJpeg(canvas, 0.85)
}
