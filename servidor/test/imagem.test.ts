import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { ErroFotoInvalida, paraJpeg, prepararFoto } from '../src/imagem/imagem.js'
import { gerarJpeg } from './ajudantes.js'

describe('prepararFoto', () => {
  it('remove metadados (EXIF/GPS)', async () => {
    const comExif = await sharp(await gerarJpeg(64, 48))
      .withExif({ IFD0: { Make: 'Celular', Model: 'Teste' }, IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '23/1 33/1 0/1' } })
      .jpeg()
      .toBuffer()
    expect((await sharp(comExif).metadata()).exif).toBeDefined()
    const m = await sharp(await prepararFoto(comExif)).metadata()
    expect(m.exif).toBeUndefined()
    expect(m.format).toBe('jpeg')
  })

  it('reduz para no máximo 1600 px', async () => {
    const m = await sharp(await prepararFoto(await gerarJpeg(4000, 3000))).metadata()
    expect([m.width, m.height]).toEqual([1600, 1200])
  })

  it('não amplia foto pequena', async () => {
    const m = await sharp(await prepararFoto(await gerarJpeg(800, 600))).metadata()
    expect([m.width, m.height]).toEqual([800, 600])
  })

  it('aplica a orientação EXIF', async () => {
    const deitada = await sharp(await gerarJpeg(400, 300)).withMetadata({ orientation: 6 }).jpeg().toBuffer()
    const m = await sharp(await prepararFoto(deitada)).metadata()
    expect([m.width, m.height]).toEqual([300, 400])
    expect(m.orientation).toBeUndefined()
  })

  it('recusa o que não é imagem', async () => {
    await expect(prepararFoto(Buffer.from('texto'))).rejects.toBeInstanceOf(ErroFotoInvalida)
  })
})

describe('paraJpeg', () => {
  it('converte PNG', async () => {
    const png = await sharp(await gerarJpeg(32, 32)).png().toBuffer()
    expect((await sharp(await paraJpeg(png)).metadata()).format).toBe('jpeg')
  })
})
