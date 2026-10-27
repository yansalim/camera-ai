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

export const SELFIE = 'test/fixtures/selfie.jpg'
