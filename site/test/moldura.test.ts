import { describe, expect, it } from 'vitest'
import { comporMoldura } from '../src/moldura'
import { carregar, pixel } from './ajudantes'
import pinturaUrl from './fixtures/pintura-800x600.png?url'

describe('comporMoldura', () => {
  it('com assinatura: dimensões, centro preservado e borda pintada', async () => {
    const b = await comporMoldura(await carregar(pinturaUrl), '@escola')
    expect(b.type).toBe('image/jpeg')
    const i = await createImageBitmap(b)
    // borda 0,08 × 600 = 48 em volta; plaqueta 0,12 × 600 = 72 embaixo
    expect([i.width, i.height]).toEqual([896, 768])
    expect(pixel(i, 448, 48 + 300)).toBeCloseToCor([51, 102, 204], 10)
    expect(pixel(i, 10, 10)).not.toBeCloseToCor([51, 102, 204], 40)
  })

  it('sem assinatura não tem plaqueta', async () => {
    const i = await createImageBitmap(await comporMoldura(await carregar(pinturaUrl), ''))
    expect([i.width, i.height]).toEqual([896, 696])
  })
})
