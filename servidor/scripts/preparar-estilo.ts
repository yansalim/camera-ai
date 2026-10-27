// Gera miniatura.jpg e referencia.jpg de um estilo a partir da imagem da obra.
// Uso: npx tsx scripts/preparar-estilo.ts <imagem-da-obra> <pasta-do-estilo> [x,y,largura,altura]
import fs from 'node:fs'
import path from 'node:path'
import sharp, { type Region } from 'sharp'

const [imagem, pasta, recorte] = process.argv.slice(2)
if (!imagem || !pasta) {
  console.error('Uso: npx tsx scripts/preparar-estilo.ts <imagem-da-obra> <pasta-do-estilo> [x,y,largura,altura]')
  process.exit(2)
}

let regiao: Region | undefined
if (recorte) {
  const [left, top, width, height] = recorte.split(',').map(Number)
  if ([left, top, width, height].some(n => !Number.isInteger(n) || n < 0)) {
    console.error(`Recorte inválido: "${recorte}" (use x,y,largura,altura em pixels)`)
    process.exit(2)
  }
  regiao = { left, top, width, height }
}

fs.mkdirSync(pasta, { recursive: true })
const base = () => {
  const s = sharp(imagem).rotate()
  return regiao ? s.extract(regiao) : s
}

const saidas = [
  { arquivo: 'miniatura.jpg', lado: 1080, qualidade: 80 },
  { arquivo: 'referencia.jpg', lado: 1024, qualidade: 85 },
]
for (const { arquivo, lado, qualidade } of saidas) {
  const destino = path.join(pasta, arquivo)
  const info = await base()
    .resize(lado, lado, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: qualidade, mozjpeg: true })
    .toFile(destino)
  console.log(`${destino}: ${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB`)
}
