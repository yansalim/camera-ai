import { abrirImagem, canvasParaJpeg } from './foto'

/**
 * Pintura numa moldura dourada de museu, com a assinatura numa plaqueta embaixo.
 * Geometria (m = menor lado): borda 0,08·m em volta; com assinatura, mais 0,12·m embaixo.
 * Primeira versão do visual; cores e fonte são acertadas com a direção visual (Task 14).
 */
export async function comporMoldura(pintura: Blob, assinatura: string): Promise<Blob> {
  const img = await abrirImagem(pintura)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const m = Math.min(w, h)
  const b = Math.round(0.08 * m)
  const p = assinatura ? Math.round(0.12 * m) : 0
  const largura = w + 2 * b
  const altura = h + 2 * b + p

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')!

  // Moldura: ouro em diagonal, com brilho e sombra.
  const ouro = ctx.createLinearGradient(0, 0, largura, altura)
  ouro.addColorStop(0, '#6b4c16')
  ouro.addColorStop(0.25, '#d4af37')
  ouro.addColorStop(0.45, '#f3e3a1')
  ouro.addColorStop(0.65, '#b8892b')
  ouro.addColorStop(1, '#5c3f10')
  ctx.fillStyle = ouro
  ctx.fillRect(0, 0, largura, altura)

  // Chanfro externo e filete interno, que dão profundidade.
  const linha = Math.max(1, Math.round(b * 0.06))
  ctx.lineWidth = linha
  ctx.strokeStyle = 'rgba(40, 26, 6, 0.55)'
  ctx.strokeRect(linha / 2, linha / 2, largura - linha, altura - linha)
  const filete = Math.max(2, Math.round(b * 0.18))
  ctx.fillStyle = '#3b2a0e'
  ctx.fillRect(b - filete, b - filete, w + 2 * filete, h + 2 * filete)
  ctx.fillStyle = '#e8cf7a'
  ctx.fillRect(b - filete / 2, b - filete / 2, w + filete, h + filete)

  ctx.drawImage(img, b, b, w, h)

  if (assinatura) {
    const fonte = Math.round(p * 0.3)
    ctx.font = `600 ${fonte}px Georgia, 'Times New Roman', serif`
    const larguraTexto = ctx.measureText(assinatura).width
    const placaL = Math.min(w * 0.8, larguraTexto + fonte * 2)
    const placaA = Math.round(p * 0.55)
    const centroY = b + h + (b + p) / 2
    const x = (largura - placaL) / 2
    const y = centroY - placaA / 2
    const latao = ctx.createLinearGradient(0, y, 0, y + placaA)
    latao.addColorStop(0, '#f5e6b0')
    latao.addColorStop(1, '#c9a24a')
    ctx.fillStyle = latao
    ctx.fillRect(x, y, placaL, placaA)
    ctx.strokeStyle = 'rgba(40, 26, 6, 0.6)'
    ctx.lineWidth = Math.max(1, Math.round(placaA * 0.04))
    ctx.strokeRect(x, y, placaL, placaA)
    ctx.fillStyle = '#2b1d08'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(assinatura, largura / 2, centroY, placaL - fonte)
  }

  return canvasParaJpeg(canvas, 0.9)
}
