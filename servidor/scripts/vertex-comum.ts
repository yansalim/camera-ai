// Partes comuns aos scripts que chamam o Vertex AI de verdade (custam crédito).
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

/** Nano Banana 2.1, Nano Banana 2 e Nano Banana Pro (ids conferidos na documentação do Vertex AI em 2026-10-27). */
export const MODELOS_PADRAO = ['gemini-nano-banana-2.1', 'gemini-3.1-flash-image', 'gemini-3-pro-image']

export const DIR_COMPARATIVO = path.resolve('comparativo')
export const DIR_ESTILOS = path.resolve(process.env.ESTILOS_DIR ?? '../estilos')

/** Projeto e região do Google Cloud; sai com instrução se o projeto não estiver definido. */
export function lerGoogle(): { projeto: string; local: string } {
  const projeto = process.env.GOOGLE_CLOUD_PROJECT?.trim()
  if (!projeto) {
    console.error(
      'Defina GOOGLE_CLOUD_PROJECT com o id do projeto no Google Cloud antes de rodar.\n' +
        '  PowerShell: $env:GOOGLE_CLOUD_PROJECT = "meu-projeto"\n' +
        '  Bash:       export GOOGLE_CLOUD_PROJECT=meu-projeto\n' +
        'O login vem de "gcloud auth application-default login".',
    )
    process.exit(2)
  }
  return { projeto, local: process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'global' }
}

/** Fotos de teste em comparativo/fotos/*.jpg, já com a rotação aplicada e reduzidas a 1600 px. */
export async function lerFotos(): Promise<Array<{ nome: string; foto: Buffer }>> {
  const dir = path.join(DIR_COMPARATIVO, 'fotos')
  const arquivos = fs.existsSync(dir) ? fs.readdirSync(dir).filter(a => /\.jpe?g$/i.test(a)).sort() : []
  if (arquivos.length === 0) {
    console.error(`Coloque fotos .jpg de teste em ${dir} (de pessoas que autorizaram o teste).`)
    process.exit(2)
  }
  return Promise.all(
    arquivos.map(async a => ({
      nome: path.parse(a).name,
      foto: await sharp(path.join(dir, a)).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
    })),
  )
}

/** Grava a saída da IA como JPEG, seja qual for o formato devolvido. */
export async function gravarJpeg(imagem: Buffer, destino: string): Promise<void> {
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  await sharp(imagem).jpeg({ quality: 90 }).toFile(destino)
}
