import { devices, expect, type Page, test } from '@playwright/test'
import { aceitarEEscolher, lerInfoDoAcervo, simularCamera, tirarFoto } from './ajudantes'

test.beforeEach(({ page }) => simularCamera(page))

// Marco 1: o estilo é a Mona Lisa. No Marco 2 o fluxo completo usa van-gogh, como no plano.
const ESTILO = 'mona-lisa'
const FRASES = /Esfumando as sombras…|Pintando a paisagem ao fundo…|Suavizando a luz…|Envelhecendo o verniz…/
const CODIGO = /^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/
const SEM_CAMERA_NO_WEBKIT =
  'O WebKit do Playwright no Windows não tem câmera (navigator.mediaDevices) nem canvas.captureStream; no iPhone de verdade a câmera é testada à mão (spec 8.5).'

/** Fluxo até o resultado; devolve o código da obra. */
async function pintarAteOResultado(page: Page): Promise<string> {
  await aceitarEEscolher(page, ESTILO)
  await tirarFoto(page)
  await expect(page.getByTestId('imagem-resultado')).toBeVisible({ timeout: 30_000 })
  return (await page.getByTestId('codigo-obra').textContent())!.replace('Código da obra: ', '')
}

test.describe('com a câmera', () => {
  test.skip(({ browserName }) => browserName === 'webkit', SEM_CAMERA_NO_WEBKIT)

  test('fluxo completo grava o acervo', async ({ page }) => {
    await aceitarEEscolher(page, ESTILO)
    const inicio = Date.now()
    await tirarFoto(page)
    await expect(page.getByTestId('tela-revelacao')).toBeVisible()
    await expect(page.getByTestId('frase-revelacao')).toHaveText(FRASES)
    await expect(page.getByTestId('imagem-resultado')).toBeVisible({ timeout: 30_000 })
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(4000)
    const codigo = (await page.getByTestId('codigo-obra').textContent())!.replace('Código da obra: ', '')
    expect(codigo).toMatch(CODIGO)
    expect(lerInfoDoAcervo('e2e/.acervo', codigo)).toMatchObject({ estiloId: ESTILO, termosVersao: 'v1' })
  })

  test('alternar para "Só a pintura" troca a imagem', async ({ page }) => {
    await pintarAteOResultado(page)
    const imagem = page.getByTestId('imagem-resultado')
    await expect(page.getByTestId('opcao-com-moldura')).toHaveAttribute('aria-pressed', 'true')
    const srcMoldura = await imagem.getAttribute('src')
    const larguraMoldura = await imagem.evaluate((i: HTMLImageElement) => i.naturalWidth)
    await page.getByTestId('opcao-so-pintura').click()
    await expect(page.getByTestId('opcao-so-pintura')).toHaveAttribute('aria-pressed', 'true')
    await expect(imagem).not.toHaveAttribute('src', srcMoldura!)
    await expect.poll(() => imagem.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeLessThan(larguraMoldura)
  })

  test('compartilhar envia o arquivo com moldura', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __arquivos: string[] }
      w.__arquivos = []
      navigator.canShare = () => true
      navigator.share = async (d?: ShareData) => {
        w.__arquivos.push(...(d?.files ?? []).map(f => f.name))
      }
    })
    const codigo = await pintarAteOResultado(page)
    await page.getByTestId('botao-compartilhar').click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __arquivos: string[] }).__arquivos)).toEqual([`pintura-moldura-${codigo}.jpg`])
  })

  test('salvar no Android baixa o arquivo', async ({ page }, info) => {
    test.skip(info.project.name !== 'android', 'só no Android')
    const codigo = await pintarAteOResultado(page)
    const download = page.waitForEvent('download')
    await page.getByTestId('botao-salvar').click()
    expect((await download).suggestedFilename()).toBe(`pintura-moldura-${codigo}.jpg`)
  })

  test('salvar no iPhone mostra a dica', async ({ browser }, info) => {
    test.skip(info.project.name !== 'android', 'roda no Chromium com o perfil do iPhone (o WebKit de teste não tem câmera)')
    const { defaultBrowserType: _, ...iphone } = devices['iPhone 13']
    const contexto = await browser.newContext({ ...iphone, baseURL: 'http://localhost:5173' })
    const page = await contexto.newPage()
    await simularCamera(page)
    await pintarAteOResultado(page)
    await page.getByTestId('botao-salvar').click()
    await expect(page.getByText('Toque e segure a imagem para salvar')).toBeVisible()
    await contexto.close()
  })

  // Marco 1: 1 cartão. No Marco 2, 6.
  test('pintar de novo volta aos quadros', async ({ page }) => {
    await pintarAteOResultado(page)
    await page.getByTestId('botao-pintar-de-novo').click()
    await expect(page.getByTestId('cartao-estilo')).toHaveCount(1)
  })

  test('erro de limite: tentar de novo reenvia a mesma foto', async ({ page }) => {
    const tamanhos: number[] = []
    let n = 0
    await page.route('**/api/pintar', async r => {
      tamanhos.push(r.request().postDataBuffer()!.length)
      if (n++ === 0) return r.fulfill({ status: 429, json: { erro: 'LIMITE_APARELHO', mensagem: 'Calma, artista! Espere alguns minutinhos para pintar de novo.' } })
      return r.continue()
    })
    await aceitarEEscolher(page, ESTILO)
    await tirarFoto(page)
    await expect(page.getByTestId('mensagem-erro')).toHaveText('Calma, artista! Espere alguns minutinhos para pintar de novo.')
    await page.getByTestId('botao-tentar-de-novo').click()
    await expect(page.getByTestId('imagem-resultado')).toBeVisible({ timeout: 30_000 })
    expect(tamanhos).toHaveLength(2)
    expect(tamanhos[1]).toBe(tamanhos[0])
  })

  test('toque duplo em tentar de novo envia um só pedido', async ({ page }) => {
    let pedidos = 0
    await page.route('**/api/pintar', async r => {
      if (pedidos++ === 0) return r.fulfill({ status: 502, json: { erro: 'IA_INDISPONIVEL', mensagem: 'A pintora está com dificuldades. Tente de novo.' } })
      return r.continue()
    })
    await aceitarEEscolher(page, ESTILO)
    await tirarFoto(page)
    await page.getByTestId('botao-tentar-de-novo').dblclick()
    await expect(page.getByTestId('imagem-resultado')).toBeVisible({ timeout: 30_000 })
    expect(pedidos).toBe(2)
  })

  test('recusa oferece tirar outra foto', async ({ page }) => {
    await page.route('**/api/pintar', r => r.fulfill({ status: 422, json: { erro: 'RECUSADA', mensagem: 'Não consegui pintar essa foto. Que tal tentar outra?' } }))
    await aceitarEEscolher(page, ESTILO)
    await tirarFoto(page)
    await expect(page.getByTestId('mensagem-erro')).toHaveText('Não consegui pintar essa foto. Que tal tentar outra?')
    await expect(page.getByTestId('botao-tentar-de-novo')).toHaveCount(0)
    await page.getByTestId('botao-outra-foto').click()
    await expect(page.getByTestId('botao-tirar-foto')).toBeVisible()
  })

  test('internet caiu', async ({ page }) => {
    await page.route('**/api/pintar', r => r.abort('internetdisconnected'))
    await aceitarEEscolher(page, ESTILO)
    await tirarFoto(page)
    await expect(page.getByTestId('mensagem-erro')).toHaveText('Parece que a internet caiu. Tente de novo.')
    await expect(page.getByTestId('botao-tentar-de-novo')).toBeVisible()
  })

  test('evento desligado durante o uso', async ({ page }) => {
    await page.route('**/api/pintar', r => r.fulfill({ status: 503, json: { erro: 'EVENTO_INATIVO', mensagem: 'Esta experiência está disponível no estande.' } }))
    await aceitarEEscolher(page, ESTILO)
    await tirarFoto(page)
    await expect(page.getByTestId('aviso-evento-inativo')).toHaveText('Esta experiência está disponível no estande.')
    await expect(page.getByTestId('botao-tentar-de-novo')).toHaveCount(0)
  })

  test('a revelação mostra as frases do estilo escolhido', async ({ page }) => {
    await aceitarEEscolher(page, ESTILO)
    await tirarFoto(page)
    await expect(page.getByTestId('frase-revelacao')).toHaveText(FRASES)
  })

  test('tirar foto abre a câmera ao vivo e não existe seletor de arquivo', async ({ page }) => {
    await aceitarEEscolher(page, ESTILO)
    await expect(page.locator('input[type="file"]')).toHaveCount(0)
    await page.getByTestId('botao-tirar-foto').click()
    await expect(page.getByTestId('camera-ao-vivo')).toBeVisible()
    await expect(page.getByTestId('botao-fotografar')).toBeVisible()
    await expect(page.getByTestId('botao-tirar-foto')).toBeHidden()
  })

})

test('câmera negada mostra o aviso e não oferece galeria', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException('negado', 'NotAllowedError') } },
    })
  })
  await aceitarEEscolher(page, ESTILO)
  await page.getByTestId('botao-tirar-foto').click()
  await expect(page.getByTestId('aviso-camera')).toHaveText('Para criar sua obra, permita o uso da câmera e toque em “Tirar foto” de novo.')
  await expect(page.getByTestId('botao-tirar-foto')).toBeVisible()
  await expect(page.locator('input[type="file"]')).toHaveCount(0)
})

test('navegador sem câmera pede para abrir no Chrome ou no Safari', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
  })
  await aceitarEEscolher(page, ESTILO)
  await page.getByTestId('botao-tirar-foto').click()
  await expect(page.getByTestId('aviso-camera')).toHaveText('Este navegador não abre a câmera. Abra o link no Chrome ou no Safari.')
})
