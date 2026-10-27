import { expect } from 'vitest'

/** Baixa um arquivo de fixture (URL vinda de `import x from './fixtures/a.jpg?url'`). */
export async function carregar(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

/** Cor RGB de um pixel do bitmap. */
export function pixel(bitmap: ImageBitmap, x: number, y: number): [number, number, number] {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
  return [r, g, b]
}

expect.extend({
  toBeCloseToCor(recebida: [number, number, number], esperada: [number, number, number], tolerancia: number) {
    const pass = recebida.every((c, i) => Math.abs(c - esperada[i]) <= tolerancia)
    return {
      pass,
      message: () => `esperava cor ${pass ? 'diferente de' : 'próxima de'} rgb(${esperada}) ±${tolerancia}, recebi rgb(${recebida})`,
    }
  },
})

declare module 'vitest' {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toBeCloseToCor(esperada: [number, number, number], tolerancia: number): R
  }
}
