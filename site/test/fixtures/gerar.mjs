// Gera as imagens de teste do site. Uso: node site/test/fixtures/gerar.mjs
import path from 'node:path'
import sharp from 'sharp'

const dir = import.meta.dirname

/** Imagem RGB com gradiente suave (comprime bem e tem cor em todo canto). */
function gradiente(largura, altura) {
  const pixels = Buffer.alloc(largura * altura * 3)
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = (y * largura + x) * 3
      pixels[i] = Math.round((x / largura) * 255)
      pixels[i + 1] = Math.round((y / altura) * 255)
      pixels[i + 2] = 160
    }
  }
  return sharp(pixels, { raw: { width: largura, height: altura, channels: 3 } })
}

await gradiente(4000, 3000).jpeg({ quality: 60 }).toFile(path.join(dir, 'paisagem-4000x3000.jpg'))
// Armazenada deitada (400×300) com orientation 6: quem respeita o EXIF mostra 300×400.
await gradiente(400, 300).withMetadata({ orientation: 6 }).jpeg({ quality: 80 }).toFile(path.join(dir, 'retrato-orientacao-6.jpg'))
await sharp({ create: { width: 800, height: 600, channels: 3, background: '#3366cc' } }).png().toFile(path.join(dir, 'pintura-800x600.png'))
await gradiente(1200, 1600).jpeg({ quality: 80 }).toFile(path.join(dir, 'selfie.jpg'))
console.log('fixtures geradas em', dir)
