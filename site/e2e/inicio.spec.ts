import { expect, test } from '@playwright/test'

test('início mostra o resumo e abre os termos', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Vire uma obra de arte' })).toBeVisible()
  await expect(page.getByText('18 anos ou mais')).toBeVisible()
  await page.getByTestId('link-termos').click()
  await expect(page).toHaveURL(/\/termos/)
  await expect(page.getByRole('heading', { name: 'Termos de uso de imagem' })).toBeVisible()
  await expect(page.getByText(/exclusão/).first()).toBeVisible()
})

// Marco 1: só a Mona Lisa. No Marco 2 espera 6 estilos, o primeiro sendo Arte Grega / Estátua de mármore.
test('aceite grava v1 e leva aos estilos em ordem', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('botao-criar').click()
  await expect(page.getByTestId('cartao-estilo')).toHaveCount(1)
  await expect(page.getByTestId('cartao-estilo').first()).toContainText('Mona Lisa')
  await expect(page.getByTestId('cartao-estilo').first()).toContainText('Leonardo da Vinci')
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('aceite')!)).termosVersao).toBe('v1')
})

test('escolher um estilo leva à tela da câmera, sem seletor de arquivo', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('botao-criar').click()
  await page.locator('[data-testid="cartao-estilo"][data-estilo-id="mona-lisa"]').click()
  await expect(page.getByTestId('botao-tirar-foto')).toBeVisible()
  await expect(page.locator('input[type="file"]')).toHaveCount(0)
})

test('evento desligado mostra o aviso e esconde o botão', async ({ page }) => {
  await page.route('**/api/saude', r => r.fulfill({ json: { ok: true, eventoAtivo: false, pinturasHoje: 0, tetoDiario: 1000, fila: 0 } }))
  await page.goto('/')
  await expect(page.getByTestId('aviso-evento-inativo')).toHaveText('Esta experiência está disponível no estande.')
  await expect(page.getByTestId('botao-criar')).toBeHidden()
})
