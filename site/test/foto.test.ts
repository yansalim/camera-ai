import { describe, expect, it } from 'vitest'
import { calcularDimensoes, prepararFoto } from '../src/foto'
import { carregar } from './ajudantes'
import paisagemUrl from './fixtures/paisagem-4000x3000.jpg?url'
import retrato6Url from './fixtures/retrato-orientacao-6.jpg?url'

describe('calcularDimensoes', () => {
  it('limita o lado maior a 1600 e não amplia', () => {
    expect(calcularDimensoes(4000, 3000)).toEqual({ largura: 1600, altura: 1200 })
    expect(calcularDimensoes(3000, 4000)).toEqual({ largura: 1200, altura: 1600 })
    expect(calcularDimensoes(1000, 800)).toEqual({ largura: 1000, altura: 800 })
  })
})

describe('prepararFoto', () => {
  it('reduz e gera JPEG', async () => {
    const b = await prepararFoto(await carregar(paisagemUrl))
    expect(b.type).toBe('image/jpeg')
    const i = await createImageBitmap(b)
    expect([i.width, i.height]).toEqual([1600, 1200])
  })

  it('aplica a rotação EXIF', async () => {
    const i = await createImageBitmap(await prepararFoto(await carregar(retrato6Url)))
    expect([i.width, i.height]).toEqual([300, 400])
  })

  it('recusa o que não é imagem', async () => {
    await expect(prepararFoto(new Blob(['texto']))).rejects.toMatchObject({
      codigo: 'FOTO_INVALIDA',
      message: 'Não consegui abrir essa foto. Tente tirar outra.',
    })
  })
})
