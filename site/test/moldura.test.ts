import { describe, expect, it } from 'vitest'
import { calcularGeometria, comporMoldura } from '../src/moldura'
import { carregar, pixel } from './ajudantes'
import pinturaUrl from './fixtures/pintura-800x600.png?url'

const ESTILOS = ['arte-grega', 'renascimento', 'cubismo', 'expressionismo', 'van-gogh', 'mona-lisa']

describe('comporMoldura', () => {
  for (const id of ESTILOS) {
    it(`${id}: dimensões, pintura intacta no centro e moldura em volta`, async () => {
      const i = await createImageBitmap(await comporMoldura(await carregar(pinturaUrl), id))
      const g = calcularGeometria(800, 600, id)
      expect([i.width, i.height]).toEqual([g.largura, g.altura])
      expect(g.altura - (g.pintura.y + g.pintura.h)).toBeGreaterThan(g.pintura.y)
      expect(pixel(i, g.pintura.x + 400, g.pintura.y + 300)).toBeCloseToCor([51, 102, 204], 10)
      expect(pixel(i, 3, 3)).not.toBeCloseToCor([51, 102, 204], 40)
    })
  }

  it('a plaqueta fica no travessão de baixo e leva a logo (o vermelho do triângulo)', async () => {
    const i = await createImageBitmap(await comporMoldura(await carregar(pinturaUrl), 'arte-grega'))
    const { placa, pintura } = calcularGeometria(800, 600, 'arte-grega')
    expect(placa.y).toBeGreaterThan(pintura.y + pintura.h)
    const canvas = new OffscreenCanvas(i.width, i.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(i, 0, 0)
    const { data } = ctx.getImageData(placa.x, placa.y, placa.w, placa.h)
    let vermelhos = 0
    for (let k = 0; k < data.length; k += 4) if (data[k] > 150 && data[k + 1] < 80 && data[k + 2] < 80) vermelhos++
    expect(vermelhos).toBeGreaterThan(50)
  })

  it('estilo sem moldura própria usa a clássica', () => {
    expect(calcularGeometria(800, 600, 'desconhecido')).toEqual(calcularGeometria(800, 600, 'arte-grega'))
  })
})
