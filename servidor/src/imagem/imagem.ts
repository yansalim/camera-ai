import sharp from 'sharp'

/** O arquivo enviado não é uma imagem que dê para abrir. */
export class ErroFotoInvalida extends Error {
  override name = 'ErroFotoInvalida'
}

/**
 * Foto do visitante: aplica a rotação EXIF, limita o lado maior a 1600 px e reencoda em JPEG.
 * O sharp não copia metadados por padrão, então EXIF e GPS ficam para trás.
 */
export async function prepararFoto(entrada: Buffer): Promise<Buffer> {
  try {
    return await sharp(entrada)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
  } catch (e) {
    throw new ErroFotoInvalida(`Não foi possível ler a foto: ${(e as Error).message}`)
  }
}

/** Normaliza a imagem devolvida pela IA (PNG, WebP…) para JPEG. */
export async function paraJpeg(entrada: Buffer): Promise<Buffer> {
  return sharp(entrada).jpeg({ quality: 90 }).toBuffer()
}
