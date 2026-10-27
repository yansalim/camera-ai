import { lerAceite, obterIdAparelho } from '../aceite'
import { ErroPintura, pintar } from '../api'
import { CONFIG } from '../config'
import { h } from '../dom'
import { abrirImagem } from '../foto'
import { comporMoldura } from '../moldura'
import { estado, irPara } from '../navegacao'

/** Mesmo se a IA responder antes, a revelação dura isso (Decisão 6). */
const DURACAO_MINIMA_MS = 4000
const TROCA_DE_FRASE_MS = 2200
const LADO_DO_CANVAS = 720

/** Um pedido por vez: toque duplo ou volta rápida não dobram o gasto nem os limites. */
let pedidoEmAndamento = false

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))
const reduzirMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Pixels de uma imagem já no tamanho do canvas, recortada para cobrir (como object-fit: cover). */
function amostrar(img: HTMLImageElement, largura: number, altura: number): ImageData {
  const c = document.createElement('canvas')
  c.width = largura
  c.height = altura
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const escala = Math.max(largura / img.naturalWidth, altura / img.naturalHeight)
  const w = img.naturalWidth * escala
  const hgt = img.naturalHeight * escala
  ctx.drawImage(img, (largura - w) / 2, (altura - hgt) / 2, w, hgt)
  return ctx.getImageData(0, 0, largura, altura)
}

/** Pinceladas curtas, cada uma com a cor da imagem no ponto onde cai, seguindo um campo de direções suave. */
function pincelar(ctx: CanvasRenderingContext2D, dados: ImageData, quantas: number, espessura: number, opacidade: number): void {
  const { width: w, height: hgt, data } = dados
  ctx.lineCap = 'round'
  for (let i = 0; i < quantas; i++) {
    const x = Math.random() * w
    const y = Math.random() * hgt
    const k = (Math.floor(y) * w + Math.floor(x)) * 4
    const angulo = Math.sin(x * 0.012) * 1.4 + Math.cos(y * 0.015) * 1.4 + (Math.random() - 0.5) * 0.5
    const traco = espessura * (1.6 + Math.random() * 2.2)
    const dx = (Math.cos(angulo) * traco) / 2
    const dy = (Math.sin(angulo) * traco) / 2
    ctx.strokeStyle = `rgba(${data[k]}, ${data[k + 1]}, ${data[k + 2]}, ${opacidade})`
    ctx.lineWidth = espessura * (0.6 + Math.random() * 0.8)
    ctx.beginPath()
    ctx.moveTo(x - dx, y - dy)
    ctx.lineTo(x + dx, y + dy)
    ctx.stroke()
  }
}

/** A foto vai sendo pintada enquanto a IA trabalha; quando a obra chega, pinceladas a revelam por cima. */
async function criarPintura(foto: Blob) {
  const imgFoto = await abrirImagem(foto)
  const escala = Math.min(1, LADO_DO_CANVAS / Math.max(imgFoto.naturalWidth, imgFoto.naturalHeight))
  const largura = Math.round(imgFoto.naturalWidth * escala)
  const altura = Math.round(imgFoto.naturalHeight * escala)
  const canvas = h('canvas', { width: String(largura), height: String(altura), 'aria-hidden': 'true' })
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(imgFoto, 0, 0, largura, altura)
  const dadosFoto = amostrar(imgFoto, largura, altura)
  const espessuraBase = largura / 40

  let ativo = !reduzirMovimento()
  const quadro = () => {
    if (!ativo || !canvas.isConnected) return
    pincelar(ctx, dadosFoto, 14, espessuraBase, 0.55)
    requestAnimationFrame(quadro)
  }
  requestAnimationFrame(quadro)

  return {
    canvas,
    parar: () => {
      ativo = false
    },
    /** Varre a tela com pinceladas da obra e termina com a obra nítida (~1,4 s; instantâneo com movimento reduzido). */
    async revelar(obra: Blob): Promise<void> {
      ativo = false
      const imgObra = await abrirImagem(obra)
      const dadosObra = amostrar(imgObra, largura, altura)
      if (!reduzirMovimento()) {
        const inicio = performance.now()
        await new Promise<void>(fim => {
          const passo = (agora: number) => {
            const t = Math.min(1, (agora - inicio) / 1100)
            pincelar(ctx, dadosObra, 90, espessuraBase * (1.4 - t), 0.85)
            if (t < 1 && canvas.isConnected) requestAnimationFrame(passo)
            else fim()
          }
          requestAnimationFrame(passo)
        })
      }
      ctx.putImageData(dadosObra, 0, 0)
      if (!reduzirMovimento()) await esperar(300)
    },
  }
}

/**
 * Revelação: manda a foto, pinta enquanto espera e revela a obra.
 * Na vitrine, `pedir: false` só anima, sem chamar a API.
 */
export async function montarRevelacao(raiz: HTMLElement, opcoes: { pedir?: boolean } = {}): Promise<void> {
  const { estilo, foto } = estado
  if (!estilo || !foto) {
    irPara(estilo ? 'foto' : 'quadros')
    return
  }
  const frase = h('p', { class: 'revelacao-frase', 'data-testid': 'frase-revelacao', 'aria-live': 'polite' }, estilo.frases[0])
  const moldura = h('figure', { class: 'revelacao-quadro' })
  raiz.append(
    h(
      'section',
      { class: 'tela tela-revelacao', 'data-testid': 'tela-revelacao' },
      h('div', { class: 'revelacao-texto' }, h('h1', { class: 'titulo', tabindex: '-1' }, 'Pintando o seu retrato'), frase),
      moldura,
    ),
  )

  let indice = 0
  const trocador = window.setInterval(() => {
    if (!frase.isConnected) return window.clearInterval(trocador)
    indice = (indice + 1) % estilo.frases.length
    frase.textContent = estilo.frases[indice]
  }, TROCA_DE_FRASE_MS)

  const pintura = await criarPintura(foto)
  moldura.append(pintura.canvas)

  if (opcoes.pedir === false || pedidoEmAndamento) return
  const aceite = lerAceite()
  if (!aceite) {
    irPara('inicio')
    return
  }

  pedidoEmAndamento = true
  const inicio = performance.now()
  try {
    const resultado = await pintar({ foto, estiloId: estilo.id, aceite, idAparelho: obterIdAparelho() })
    const comMoldura = await comporMoldura(resultado.imagem, CONFIG.assinatura)
    const falta = DURACAO_MINIMA_MS - (performance.now() - inicio)
    if (falta > 0) await esperar(falta)
    estado.resultado = resultado
    estado.comMoldura = comMoldura
    await pintura.revelar(resultado.imagem)
    irPara('resultado')
  } catch (e) {
    pintura.parar()
    irPara('erro', { erro: e instanceof ErroPintura ? e : new ErroPintura('IA_INDISPONIVEL', 'A pintora está com dificuldades. Tente de novo.') })
  } finally {
    pedidoEmAndamento = false
    window.clearInterval(trocador)
  }
}
