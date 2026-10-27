import { afterEach, describe, expect, it, vi } from 'vitest'
import { compartilhar, ehIOS } from '../src/compartilhar'

afterEach(() => vi.unstubAllGlobals())
const blob = new Blob(['x'], { type: 'image/jpeg' })

describe('ehIOS', () => {
  it('reconhece iPhone e iPad (inclusive iPadOS com UA de Mac)', () => {
    expect(ehIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true)
    expect(ehIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
    expect(ehIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(ehIOS('Mozilla/5.0 (Linux; Android 14; Pixel 7)', 5)).toBe(false)
  })
})

describe('compartilhar', () => {
  it('sem suporte a arquivos devolve indisponivel', async () => {
    vi.stubGlobal('navigator', { canShare: () => false })
    expect(await compartilhar(blob, 'a.jpg')).toBe('indisponivel')
  })

  it('envia o arquivo com o nome pedido', async () => {
    const share = vi.fn(async (_dados: ShareData) => {})
    vi.stubGlobal('navigator', { canShare: () => true, share })
    expect(await compartilhar(blob, 'pintura-moldura-K7M-3PX.jpg')).toBe('compartilhado')
    expect(share.mock.calls[0][0].files?.[0].name).toBe('pintura-moldura-K7M-3PX.jpg')
  })

  it('pessoa que fecha o menu é cancelado, não erro', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: async () => { throw new DOMException('fechou', 'AbortError') } })
    expect(await compartilhar(blob, 'a.jpg')).toBe('cancelado')
  })
})
