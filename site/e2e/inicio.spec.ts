import { expect, test } from '@playwright/test'

test('início não mostra o resumo; o resumo fica nos termos', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'IAutorretrato' })).toBeVisible()
  await expect(page.getByText('18 anos ou mais')).toHaveCount(0)
  await page.getByTestId('link-termos').click()
  await expect(page).toHaveURL(/\/termos/)
  await expect(page.getByRole('heading', { name: 'Termos de uso de imagem' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Em resumo' })).toBeVisible()
  await expect(page.getByText(/declara ter 18 anos ou mais e autoriza a escola/)).toBeVisible()
  await expect(page.getByText(/exclusão/).first()).toBeVisible()
})

test('aceite grava v1 e leva aos 6 estilos em ordem', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('botao-criar').click()
  const cartoes = page.getByTestId('cartao-estilo')
  await expect(cartoes).toHaveCount(6)
  for (const [i, id] of ['arte-grega', 'renascimento', 'cubismo', 'expressionismo', 'van-gogh', 'mona-lisa'].entries())
    await expect(cartoes.nth(i)).toHaveAttribute('data-estilo-id', id)
  await expect(cartoes.first()).toContainText('Arte Grega')
  await expect(cartoes.first()).toContainText('Hermes · Praxíteles')
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
