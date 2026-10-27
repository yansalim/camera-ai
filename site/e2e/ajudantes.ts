import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'

/** Do início até a tela da foto: aceita os termos e escolhe o estilo. */
export async function aceitarEEscolher(page: Page, estiloId: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('botao-criar').click()
  await page.locator(`[data-testid="cartao-estilo"][data-estilo-id="${estiloId}"]`).click()
  await page.getByTestId('botao-tirar-foto').waitFor()
}

/** info.json de uma obra no acervo de teste, procurando o código em todas as datas. */
export function lerInfoDoAcervo(dir: string, codigo: string): Record<string, unknown> {
  for (const dia of fs.readdirSync(dir)) {
    const arquivo = path.join(dir, dia, codigo, 'info.json')
    if (fs.existsSync(arquivo)) return JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  }
  throw new Error(`Obra ${codigo} não está em ${dir}`)
}

/** Câmera simulada: um canvas animado no lugar da câmera frontal (o navegador de teste não tem câmera). */
export async function simularCamera(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = 960
    const ctx = canvas.getContext('2d')!
    let quadro = 0
    const desenhar = () => {
      ctx.fillStyle = '#7a5c3c'
      ctx.fillRect(0, 0, 720, 960)
      ctx.fillStyle = '#e8c39e'
      ctx.beginPath()
      ctx.arc(360 + Math.sin(quadro++ / 8) * 12, 420, 170, 0, Math.PI * 2)
      ctx.fill()
    }
    desenhar()
    setInterval(desenhar, 33)
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => canvas.captureStream(30) } })
  })
}

/** Na tela da foto: abre a câmera e fotografa. */
export async function tirarFoto(page: Page): Promise<void> {
  await page.getByTestId('botao-tirar-foto').click()
  await page.getByTestId('camera-ao-vivo').waitFor()
  await page.getByTestId('botao-fotografar').click()
}
