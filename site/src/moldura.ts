import logoUrl from './assets/logo-ctpm.png'
import { CONFIG } from './config'
import { abrirImagem, canvasParaJpeg } from './foto'

/**
 * Moldura do resultado: uma moldura clássica própria de cada estilo. Dentro dela, um painel
 * (passe-partout de mármore, laca, veludo, papelão) envolve a pintura e desce até a plaqueta
 * da feira, com a logo da escola e o texto de CONFIG.moldura, como a legenda de um museu.
 *
 * Geometria (m = menor lado da pintura): folga p = 0,04·m do painel em volta da pintura,
 * legenda de r = 0,24·m embaixo dela e travessão b = borda·m em volta de tudo.
 */

type Ctx = CanvasRenderingContext2D
type Retangulo = { x: number; y: number; w: number; h: number }
type Lado = 'topo' | 'esquerda' | 'direita' | 'base'

/** Uma faixa do perfil da moldura, com espessura em fração do travessão. */
interface Faixa {
  t: number
  cor: string
  /** Convexo: brilho no meio. Côncavo: sombra no meio. Plano: cor chapada (com luz de lado). */
  relevo: 'convexo' | 'concavo' | 'plano'
}

interface Desenho {
  /** Travessão em fração do menor lado da pintura. */
  borda: number
  /** Perfil do travessão, de fora para dentro; as espessuras somam 1. */
  perfil: Faixa[]
  /** Painel dentro da moldura, em volta da pintura e embaixo dela. */
  painel: (ctx: Ctx, r: Retangulo, m: number) => void
  /** Filete em volta da pintura (a borda da janela). */
  filete: string
  /** Enfeites desenhados por cima do travessão (cantos, contas, rosetas). */
  enfeites?: (ctx: Ctx, g: Geometria, d: Desenho) => void
  placa: {
    fundo: (ctx: Ctx, r: Retangulo) => void
    borda: string
    texto: string
    /** Sombra clara do texto (letra gravada). */
    gravado?: string
    fonte: string
    raio: number
  }
}

export interface Geometria {
  largura: number
  altura: number
  /** Onde a pintura fica. */
  pintura: Retangulo
  /** Painel dentro da moldura. */
  painel: Retangulo
  /** Retângulo da plaqueta. */
  placa: Retangulo
  /** Travessão em px. */
  b: number
  m: number
}

const SERIFA = "Georgia, 'Times New Roman', serif"
const GROTESCA = "'Schibsted Grotesk', 'Helvetica Neue', Arial, sans-serif"

// ---------- cores e utilidades ----------

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Clareia (q > 0) ou escurece (q < 0) uma cor, q entre -1 e 1. */
function tom(hex: string, q: number): string {
  const [r, g, b] = rgb(hex)
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, q >= 0 ? c + (255 - c) * q : c * (1 + q))))
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`
}

/** Sorteio determinístico, para a madeira e o mármore saírem sempre iguais. */
function sorteador(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const expandir = (r: Retangulo, d: number): Retangulo => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d })

/** Distância da borda de fora até o meio da faixa i do perfil, em px. */
function meioDaFaixa(d: Desenho, i: number, b: number): number {
  let soma = 0
  for (let k = 0; k < i; k++) soma += d.perfil[k].t
  return (soma + d.perfil[i].t / 2) * b
}

// ---------- perfil da moldura ----------

/** Trapézio de um lado de um anel de espessura t, com o canto em meia-esquadria. */
function trapezio(ctx: Ctx, r: Retangulo, t: number, lado: Lado) {
  const { x, y, w, h } = r
  const p: Record<Lado, [number, number][]> = {
    topo: [[x, y], [x + w, y], [x + w - t, y + t], [x + t, y + t]],
    base: [[x, y + h], [x + w, y + h], [x + w - t, y + h - t], [x + t, y + h - t]],
    esquerda: [[x, y], [x + t, y + t], [x + t, y + h - t], [x, y + h]],
    direita: [[x + w, y], [x + w - t, y + t], [x + w - t, y + h - t], [x + w, y + h]],
  }
  ctx.beginPath()
  p[lado].forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
  ctx.closePath()
}

/** Luz vinda de cima à esquerda. */
const LUZ: Record<Lado, number> = { topo: 0.2, esquerda: 0.08, direita: -0.16, base: -0.28 }

/** Anel com relevo, cantos em meia-esquadria. */
function anel(ctx: Ctx, r: Retangulo, t: number, faixa: Faixa) {
  for (const lado of ['topo', 'base', 'esquerda', 'direita'] as Lado[]) {
    const luz = LUZ[lado]
    // Gradiente atravessando a faixa, de fora (0) para dentro (1).
    const g =
      lado === 'topo' ? ctx.createLinearGradient(0, r.y, 0, r.y + t)
      : lado === 'base' ? ctx.createLinearGradient(0, r.y + r.h, 0, r.y + r.h - t)
      : lado === 'esquerda' ? ctx.createLinearGradient(r.x, 0, r.x + t, 0)
      : ctx.createLinearGradient(r.x + r.w, 0, r.x + r.w - t, 0)
    if (faixa.relevo === 'plano') {
      g.addColorStop(0, tom(faixa.cor, luz * 0.5))
      g.addColorStop(1, tom(faixa.cor, luz * 0.5))
    } else if (faixa.relevo === 'convexo') {
      g.addColorStop(0, tom(faixa.cor, luz - 0.45))
      g.addColorStop(0.35, tom(faixa.cor, luz + 0.5))
      g.addColorStop(0.55, tom(faixa.cor, luz + 0.15))
      g.addColorStop(1, tom(faixa.cor, luz - 0.5))
    } else {
      g.addColorStop(0, tom(faixa.cor, luz + 0.3))
      g.addColorStop(0.5, tom(faixa.cor, luz - 0.45))
      g.addColorStop(1, tom(faixa.cor, luz + 0.2))
    }
    trapezio(ctx, r, t, lado)
    ctx.fillStyle = g
    ctx.fill()
  }
}

/** Perfil do travessão, de fora para dentro. */
function desenharPerfil(ctx: Ctx, r: Retangulo, faixas: Faixa[], b: number) {
  let atual = r
  let resto = b
  faixas.forEach((f, i) => {
    const t = i === faixas.length - 1 ? resto : Math.max(1, Math.round(f.t * b))
    anel(ctx, atual, t, f)
    atual = expandir(atual, -t)
    resto -= t
  })
  // Sombra do travessão sobre o painel.
  const s = Math.max(2, b * 0.12)
  for (const lado of ['topo', 'esquerda'] as const) {
    const g = lado === 'topo' ? ctx.createLinearGradient(0, atual.y, 0, atual.y + s) : ctx.createLinearGradient(atual.x, 0, atual.x + s, 0)
    g.addColorStop(0, 'rgba(0, 0, 0, 0.45)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    if (lado === 'topo') ctx.fillRect(atual.x, atual.y, atual.w, s)
    else ctx.fillRect(atual.x, atual.y, s, atual.h)
  }
}

// ---------- materiais dos painéis ----------

/** Madeira, papelão ou tecido: cor com veios ou fibras finas. */
const fibras = (cor: string, semente: number, intensidade = 0.16, quantas = 220) => (ctx: Ctx, r: Retangulo, m: number) => {
  ctx.fillStyle = cor
  ctx.fillRect(r.x, r.y, r.w, r.h)
  const sortear = sorteador(semente)
  ctx.save()
  ctx.beginPath()
  ctx.rect(r.x, r.y, r.w, r.h)
  ctx.clip()
  ctx.globalAlpha = intensidade
  ctx.lineWidth = Math.max(1, m / 700)
  for (let i = 0; i < quantas; i++) {
    ctx.strokeStyle = sortear() > 0.5 ? tom(cor, 0.4) : tom(cor, -0.5)
    const y = r.y + sortear() * r.h
    const x = r.x + sortear() * r.w * 0.6
    const comp = r.w * (0.2 + sortear() * 0.6)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x + comp * 0.3, y + (sortear() - 0.5) * m * 0.008, x + comp * 0.7, y + (sortear() - 0.5) * m * 0.008, x + comp, y)
    ctx.stroke()
  }
  ctx.restore()
}

/** Veludo: cor funda com brilho suave no meio. */
const veludo = (cor: string) => (ctx: Ctx, r: Retangulo) => {
  const g = ctx.createRadialGradient(r.x + r.w * 0.45, r.y + r.h * 0.4, 0, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.75)
  g.addColorStop(0, tom(cor, 0.12))
  g.addColorStop(1, tom(cor, -0.35))
  ctx.fillStyle = g
  ctx.fillRect(r.x, r.y, r.w, r.h)
}

/** Mármore claro com veios cinza. */
const marmore = (semente: number) => (ctx: Ctx, r: Retangulo, m: number) => {
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h)
  g.addColorStop(0, '#f3efe6')
  g.addColorStop(1, '#e0d9cb')
  ctx.fillStyle = g
  ctx.fillRect(r.x, r.y, r.w, r.h)
  const sortear = sorteador(semente)
  ctx.save()
  ctx.beginPath()
  ctx.rect(r.x, r.y, r.w, r.h)
  ctx.clip()
  ctx.filter = `blur(${Math.max(0.5, m / 900)}px)`
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(120, 112, 100, ${0.05 + sortear() * 0.09})`
    ctx.lineWidth = Math.max(1, (m / 900) * (0.4 + sortear() * 1.4))
    ctx.beginPath()
    let x = r.x + sortear() * r.w
    let y = r.y
    ctx.moveTo(x, y)
    while (y < r.y + r.h) {
      const nx = x + (sortear() - 0.45) * m * 0.14
      const ny = y + m * (0.05 + sortear() * 0.1)
      ctx.quadraticCurveTo(x + (sortear() - 0.5) * m * 0.08, (y + ny) / 2, nx, ny)
      x = nx
      y = ny
    }
    ctx.stroke()
  }
  ctx.restore()
}

/** Latão escovado da plaqueta (preenche o caminho atual). */
const latao = (ctx: Ctx, r: Retangulo) => {
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h)
  g.addColorStop(0, '#f6e7b0')
  g.addColorStop(0.45, '#d8b768')
  g.addColorStop(0.55, '#c9a24a')
  g.addColorStop(1, '#9c7a30')
  ctx.fillStyle = g
  ctx.fill()
}

const chapado = (cor: string) => (ctx: Ctx) => {
  ctx.fillStyle = cor
  ctx.fill()
}

// ---------- enfeites ----------

/** Fileira de contas (pérolas) num anel à distância d da borda de fora. */
function contas(ctx: Ctx, g: Geometria, d: number, raio: number, cor: string) {
  const r = expandir({ x: 0, y: 0, w: g.largura, h: g.altura }, -d)
  const passo = raio * 2.5
  const ponto = (x: number, y: number) => {
    const gr = ctx.createRadialGradient(x - raio * 0.35, y - raio * 0.35, raio * 0.1, x, y, raio)
    gr.addColorStop(0, tom(cor, 0.7))
    gr.addColorStop(0.55, cor)
    gr.addColorStop(1, tom(cor, -0.55))
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.arc(x, y, raio, 0, Math.PI * 2)
    ctx.fill()
  }
  const nx = Math.max(1, Math.round(r.w / passo))
  const ny = Math.max(1, Math.round(r.h / passo))
  for (let i = 0; i <= nx; i++) {
    ponto(r.x + (r.w * i) / nx, r.y)
    ponto(r.x + (r.w * i) / nx, r.y + r.h)
  }
  for (let i = 1; i < ny; i++) {
    ponto(r.x, r.y + (r.h * i) / ny)
    ponto(r.x + r.w, r.y + (r.h * i) / ny)
  }
}

/** Folhas miúdas inclinadas (friso renascentista) num anel à distância d da borda de fora. */
function friso(ctx: Ctx, g: Geometria, d: number, tam: number, cor: string) {
  const r = expandir({ x: 0, y: 0, w: g.largura, h: g.altura }, -d)
  const folha = (x: number, y: number, ang: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    const gr = ctx.createLinearGradient(0, -tam * 0.4, 0, tam * 0.4)
    gr.addColorStop(0, tom(cor, 0.55))
    gr.addColorStop(1, tom(cor, -0.5))
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.ellipse(0, 0, tam, tam * 0.36, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = tom(cor, -0.6)
    ctx.lineWidth = Math.max(1, tam * 0.08)
    ctx.beginPath()
    ctx.moveTo(-tam * 0.8, 0)
    ctx.lineTo(tam * 0.8, 0)
    ctx.stroke()
    ctx.restore()
  }
  const passo = tam * 1.55
  const nx = Math.round(r.w / passo)
  const ny = Math.round(r.h / passo)
  for (let i = 0; i < nx; i++) {
    const x = r.x + (r.w * (i + 0.5)) / nx
    folha(x, r.y, 0.75)
    folha(x, r.y + r.h, -0.75)
  }
  for (let i = 0; i < ny; i++) {
    const y = r.y + (r.h * (i + 0.5)) / ny
    folha(r.x, y, Math.PI / 2 - 0.75)
    folha(r.x + r.w, y, Math.PI / 2 + 0.75)
  }
}

/** Roseta de pétalas, como as dos tabernáculos florentinos. */
function roseta(ctx: Ctx, x: number, y: number, raio: number, petala: string, miolo: string) {
  // Disco de fundo.
  ctx.fillStyle = tom(miolo, -0.2)
  ctx.beginPath()
  ctx.arc(x, y, raio * 1.08, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 8; i++) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((i / 8) * Math.PI * 2 + Math.PI / 8)
    const g = ctx.createLinearGradient(0, -raio * 0.2, 0, raio * 0.2)
    g.addColorStop(0, tom(petala, 0.5))
    g.addColorStop(1, tom(petala, -0.45))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(raio * 0.55, 0, raio * 0.45, raio * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  const g = ctx.createRadialGradient(x - raio * 0.08, y - raio * 0.08, 0, x, y, raio * 0.3)
  g.addColorStop(0, tom(petala, 0.6))
  g.addColorStop(1, tom(petala, -0.4))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, raio * 0.26, 0, Math.PI * 2)
  ctx.fill()
}

/** Leque de folhas de acanto com concha, num canto barroco. sx/sy apontam para dentro. */
function acanto(ctx: Ctx, x: number, y: number, tam: number, sx: number, sy: number, cor: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(sx, sy)
  const folha = (ang: number, comp: number) => {
    ctx.save()
    ctx.rotate(ang)
    const g = ctx.createLinearGradient(0, -comp * 0.22, 0, comp * 0.16)
    g.addColorStop(0, tom(cor, 0.55))
    g.addColorStop(1, tom(cor, -0.55))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(comp * 0.25, -comp * 0.3, comp * 0.75, -comp * 0.26, comp, -comp * 0.02)
    ctx.bezierCurveTo(comp * 0.8, comp * 0.02, comp * 0.85, comp * 0.12, comp * 0.62, comp * 0.1)
    ctx.bezierCurveTo(comp * 0.4, comp * 0.14, comp * 0.2, comp * 0.12, 0, 0)
    ctx.fill()
    ctx.strokeStyle = tom(cor, -0.6)
    ctx.lineWidth = Math.max(1, comp * 0.03)
    ctx.beginPath()
    ctx.moveTo(comp * 0.1, -comp * 0.02)
    ctx.quadraticCurveTo(comp * 0.5, -comp * 0.1, comp * 0.92, -comp * 0.03)
    ctx.stroke()
    ctx.restore()
  }
  // Folhas abertas em leque, do topo (0) ao lado (π/2).
  for (const [a, c] of [[0.02, 1], [0.38, 0.8], [0.785, 0.62], [1.19, 0.8], [1.55, 1]] as const) folha(a, tam * c)
  // Concha no canto.
  ctx.save()
  ctx.rotate(Math.PI / 4)
  for (let i = -3; i <= 3; i++) {
    ctx.save()
    ctx.rotate(i * 0.24)
    const g = ctx.createLinearGradient(0, 0, tam * 0.42, 0)
    g.addColorStop(0, tom(cor, -0.4))
    g.addColorStop(1, tom(cor, 0.5))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(tam * 0.42, -tam * 0.05)
    ctx.lineTo(tam * 0.42, tam * 0.05)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
  ctx.restore()
}

/** Ornamento no meio de um lado (barroco): duas volutas e um medalhão. ang gira para o lado. */
function cartela(ctx: Ctx, x: number, y: number, tam: number, ang: number, cor: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  for (const s of [-1, 1]) {
    ctx.save()
    ctx.scale(s, 1)
    const g = ctx.createLinearGradient(0, -tam * 0.25, 0, tam * 0.25)
    g.addColorStop(0, tom(cor, 0.5))
    g.addColorStop(1, tom(cor, -0.5))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(tam * 0.1, -tam * 0.12)
    ctx.bezierCurveTo(tam * 0.45, -tam * 0.3, tam * 0.85, -tam * 0.15, tam, tam * 0.02)
    ctx.bezierCurveTo(tam * 0.75, -tam * 0.02, tam * 0.5, tam * 0.08, tam * 0.1, tam * 0.12)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  const g = ctx.createRadialGradient(-tam * 0.04, -tam * 0.05, 0, 0, 0, tam * 0.2)
  g.addColorStop(0, tom(cor, 0.65))
  g.addColorStop(1, tom(cor, -0.4))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, 0, tam * 0.15, tam * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Blocos em degrau nos cantos (moldura cubista). */
function degraus(ctx: Ctx, g: Geometria, cores: string[]) {
  const linha = Math.max(1, g.b * 0.03)
  for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [g.largura, 0, -1, 1], [0, g.altura, 1, -1], [g.largura, g.altura, -1, -1]] as const) {
    cores.forEach((cor, i) => {
      const lado = g.b * (1 - i * 0.26)
      const x = sx > 0 ? cx : cx - lado
      const y = sy > 0 ? cy : cy - lado
      ctx.fillStyle = cor
      ctx.fillRect(x, y, lado, lado)
      ctx.strokeStyle = '#1d1a16'
      ctx.lineWidth = linha
      ctx.strokeRect(x + linha / 2, y + linha / 2, lado - linha, lado - linha)
    })
  }
}

// ---------- as seis molduras ----------

const OURO = '#c99a35'

const DESENHOS: Record<string, Desenho> = {
  // Clássica de museu: nogueira, filete dourado e passe-partout de mármore com a legenda gravada.
  'arte-grega': {
    borda: 0.11,
    perfil: [
      { t: 0.14, cor: '#4a3220', relevo: 'convexo' },
      { t: 0.1, cor: OURO, relevo: 'convexo' },
      { t: 0.42, cor: '#3a2617', relevo: 'concavo' },
      { t: 0.14, cor: '#5a3d26', relevo: 'convexo' },
      { t: 0.2, cor: OURO, relevo: 'convexo' },
    ],
    painel: marmore(7),
    filete: '#b8a37a',
    placa: {
      fundo: (ctx, r) => {
        ctx.save()
        ctx.clip()
        marmore(3)(ctx, r, r.h * 3)
        ctx.restore()
      },
      borda: '#a8915a',
      texto: '#3b342b',
      gravado: 'rgba(255, 255, 255, 0.75)',
      fonte: SERIFA,
      raio: 0,
    },
  },

  // Tabernáculo florentino: ouro, faixa azul com pontos dourados e rosetas nos cantos.
  renascimento: {
    borda: 0.15,
    perfil: [
      { t: 0.1, cor: OURO, relevo: 'convexo' },
      { t: 0.08, cor: '#8a6420', relevo: 'concavo' },
      { t: 0.36, cor: '#1f3f8a', relevo: 'plano' },
      { t: 0.08, cor: '#8a6420', relevo: 'concavo' },
      { t: 0.2, cor: OURO, relevo: 'convexo' },
      { t: 0.18, cor: '#e0bf62', relevo: 'concavo' },
    ],
    painel: veludo('#1a2f5e'),
    filete: '#e0bf62',
    enfeites: (ctx, g, d) => {
      const meio = meioDaFaixa(d, 2, g.b)
      contas(ctx, g, meio, g.b * 0.045, '#e8cf7a')
      for (const [x, y] of [[meio, meio], [g.largura - meio, meio], [meio, g.altura - meio], [g.largura - meio, g.altura - meio]])
        roseta(ctx, x, y, g.b * 0.3, '#e3c46a', '#1f3f8a')
    },
    placa: { fundo: latao, borda: '#6b4c16', texto: '#2b1d08', fonte: SERIFA, raio: 0.1 },
  },

  // Moldura reta dos anos 1910: perfil em degraus, ocre e cinza foscos, cantos em blocos.
  cubismo: {
    borda: 0.11,
    perfil: [
      { t: 0.12, cor: '#2a2723', relevo: 'plano' },
      { t: 0.3, cor: '#9a9384', relevo: 'plano' },
      { t: 0.1, cor: '#2a2723', relevo: 'plano' },
      { t: 0.3, cor: '#b88a3e', relevo: 'plano' },
      { t: 0.18, cor: '#5f6b74', relevo: 'plano' },
    ],
    painel: fibras('#d5cebf', 5, 0.1, 160),
    filete: '#2a2723',
    enfeites: (ctx, g) => degraus(ctx, g, ['#2a2723', '#b88a3e', '#5f6b74']),
    placa: { fundo: chapado('#efe9dc'), borda: '#1d1a16', texto: '#1d1a16', fonte: GROTESCA, raio: 0 },
  },

  // Madeira escura rústica, larga e simples, com filete laranja-queimado e fundo de papelão.
  expressionismo: {
    borda: 0.13,
    perfil: [
      { t: 0.22, cor: '#2a1d15', relevo: 'convexo' },
      { t: 0.5, cor: '#33241a', relevo: 'concavo' },
      { t: 0.1, cor: '#c2551f', relevo: 'plano' },
      { t: 0.18, cor: '#2a1d15', relevo: 'convexo' },
    ],
    painel: fibras('#9b7a55', 23, 0.22, 320),
    filete: '#c2551f',
    enfeites: (ctx, g, d) => {
      // Veios na madeira do travessão.
      const sortear = sorteador(41)
      ctx.save()
      ctx.globalAlpha = 0.25
      ctx.lineWidth = Math.max(1, g.m / 800)
      const fim = (d.perfil[0].t + d.perfil[1].t) * g.b
      for (let i = 0; i < 90; i++) {
        const k = g.b * 0.05 + sortear() * (fim - g.b * 0.1)
        ctx.strokeStyle = sortear() > 0.5 ? '#6b4a32' : '#0d0805'
        const r = expandir({ x: 0, y: 0, w: g.largura, h: g.altura }, -k)
        ctx.strokeRect(r.x, r.y, r.w, r.h)
      }
      ctx.restore()
    },
    placa: { fundo: chapado('#ecdfc2'), borda: '#c2551f', texto: '#2b1e16', fonte: SERIFA, raio: 0.04 },
  },

  // Ouro barroco entalhado, com acantos nos cantos e veludo azul-noite puxando o céu estrelado.
  'van-gogh': {
    borda: 0.17,
    perfil: [
      { t: 0.08, cor: '#9a7024', relevo: 'convexo' },
      { t: 0.1, cor: '#7a5418', relevo: 'concavo' },
      { t: 0.34, cor: OURO, relevo: 'convexo' },
      { t: 0.12, cor: '#8a6420', relevo: 'concavo' },
      { t: 0.1, cor: '#e0bf62', relevo: 'convexo' },
      { t: 0.26, cor: '#a67c2a', relevo: 'concavo' },
    ],
    painel: veludo('#16244a'),
    filete: '#e0bf62',
    enfeites: (ctx, g, d) => {
      const cor = '#d6ac48'
      const t = g.b * 0.9
      const k = g.b * 0.12
      acanto(ctx, k, k, t, 1, 1, cor)
      acanto(ctx, g.largura - k, k, t, -1, 1, cor)
      acanto(ctx, k, g.altura - k, t, 1, -1, cor)
      acanto(ctx, g.largura - k, g.altura - k, t, -1, -1, cor)
      const meio = meioDaFaixa(d, 2, g.b)
      cartela(ctx, g.largura / 2, meio, g.b * 0.75, 0, cor)
      cartela(ctx, g.largura / 2, g.altura - meio, g.b * 0.75, Math.PI, cor)
      cartela(ctx, meio, g.altura / 2, g.b * 0.75, -Math.PI / 2, cor)
      cartela(ctx, g.largura - meio, g.altura / 2, g.b * 0.75, Math.PI / 2, cor)
      contas(ctx, g, meioDaFaixa(d, 4, g.b), g.b * 0.04, '#e8cf7a')
    },
    placa: { fundo: latao, borda: '#6b4c16', texto: '#2b1d08', fonte: SERIFA, raio: 0.1 },
  },

  // Ouro renascentista largo, com friso de folhas, contas e veludo de nogueira.
  'mona-lisa': {
    borda: 0.16,
    perfil: [
      { t: 0.08, cor: '#7a5a1c', relevo: 'convexo' },
      { t: 0.3, cor: OURO, relevo: 'convexo' },
      { t: 0.1, cor: '#8a6420', relevo: 'concavo' },
      { t: 0.1, cor: '#e0bf62', relevo: 'convexo' },
      { t: 0.2, cor: '#a67c2a', relevo: 'concavo' },
      { t: 0.22, cor: '#4a3020', relevo: 'concavo' },
    ],
    painel: veludo('#3a2a1c'),
    filete: '#d4af37',
    enfeites: (ctx, g, d) => {
      friso(ctx, g, meioDaFaixa(d, 1, g.b), g.b * 0.1, '#d6ac48')
      contas(ctx, g, meioDaFaixa(d, 3, g.b), g.b * 0.038, '#e8cf7a')
    },
    placa: { fundo: latao, borda: '#5c3f10', texto: '#2b1d08', fonte: SERIFA, raio: 0.1 },
  },
}

/** Moldura de um estilo; estilo sem moldura própria usa a clássica da Arte Grega. */
const desenhoDe = (estiloId: string): Desenho => DESENHOS[estiloId] ?? DESENHOS['arte-grega']

/** Medidas da moldura para uma pintura w×h. */
export function calcularGeometria(w: number, h: number, estiloId: string): Geometria {
  const d = desenhoDe(estiloId)
  const m = Math.min(w, h)
  const b = Math.round(d.borda * m)
  const p = Math.round(0.04 * m)
  const legenda = Math.round(0.24 * m)
  const painel = { x: b, y: b, w: w + 2 * p, h: h + 2 * p + legenda }
  const pintura = { x: b + p, y: b + p, w, h }
  const alturaPlaca = Math.round(legenda * 0.64)
  const larguraPlaca = Math.round(Math.min(w * 0.94, alturaPlaca * 4.6))
  const centroPlaca = pintura.y + h + (legenda + 2 * p) / 2
  const placa = { x: Math.round(b + p + (w - larguraPlaca) / 2), y: Math.round(centroPlaca - alturaPlaca / 2), w: larguraPlaca, h: alturaPlaca }
  return { largura: w + 2 * (b + p), altura: h + 2 * (b + p) + legenda, pintura, painel, placa, b, m }
}

let logoCarregada: Promise<HTMLImageElement> | undefined
const carregarLogo = () => {
  logoCarregada ??= (async () => {
    const img = new Image()
    img.src = logoUrl
    await img.decode()
    return img
  })()
  return logoCarregada
}

function desenharPlaca(ctx: Ctx, g: Geometria, d: Desenho, logo: HTMLImageElement) {
  const r = g.placa
  const raio = r.h * d.placa.raio
  const caminho = (q: Retangulo, rr: number) => {
    ctx.beginPath()
    ctx.roundRect(q.x, q.y, q.w, q.h, rr)
  }
  // Sombra da plaqueta sobre o painel.
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
  ctx.shadowBlur = r.h * 0.14
  ctx.shadowOffsetY = r.h * 0.06
  caminho(r, raio)
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()

  caminho(r, raio)
  d.placa.fundo(ctx, r)
  ctx.lineWidth = Math.max(1, r.h * 0.025)
  ctx.strokeStyle = d.placa.borda
  caminho(expandir(r, -r.h * 0.06), raio * 0.7)
  ctx.stroke()

  // Logo à esquerda, texto à direita, o conjunto centrado.
  const alturaLogo = r.h * 0.8
  const larguraLogo = alturaLogo * (logo.naturalWidth / logo.naturalHeight)
  const folga = r.h * 0.2
  const { titulo, subtitulo } = CONFIG.moldura
  const sub = subtitulo.toUpperCase()
  let tamTitulo = r.h * 0.27
  let tamSub = r.h * 0.17
  const medir = () => {
    ctx.font = `700 ${tamTitulo}px ${d.placa.fonte}`
    const a = ctx.measureText(titulo).width
    ctx.font = `400 ${tamSub}px ${d.placa.fonte}`
    ctx.letterSpacing = `${tamSub * 0.3}px`
    const b = ctx.measureText(sub).width
    ctx.letterSpacing = '0px'
    return Math.max(a, b)
  }
  const maxTexto = r.w - larguraLogo - folga * 3
  let larguraTexto = medir()
  if (larguraTexto > maxTexto) {
    const f = maxTexto / larguraTexto
    tamTitulo *= f
    tamSub *= f
    larguraTexto = medir()
  }
  const x0 = r.x + (r.w - (larguraLogo + folga + larguraTexto)) / 2
  ctx.drawImage(logo, x0, r.y + (r.h - alturaLogo) / 2, larguraLogo, alturaLogo)

  const xt = x0 + larguraLogo + folga
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const escrever = (texto: string, peso: number, tam: number, y: number, espaco: number) => {
    ctx.font = `${peso} ${tam}px ${d.placa.fonte}`
    ctx.letterSpacing = `${espaco}px`
    if (d.placa.gravado) {
      ctx.fillStyle = d.placa.gravado
      ctx.fillText(texto, xt, y + Math.max(1, tam * 0.06))
    }
    ctx.fillStyle = d.placa.texto
    ctx.fillText(texto, xt, y)
  }
  const meio = r.y + r.h / 2
  escrever(titulo, 700, tamTitulo, meio - r.h * 0.02, 0)
  // Filete entre as linhas.
  ctx.fillStyle = d.placa.borda
  ctx.fillRect(xt, meio + r.h * 0.06, larguraTexto, Math.max(1, r.h * 0.012))
  escrever(sub, 400, tamSub, meio + r.h * 0.28, tamSub * 0.3)
  ctx.letterSpacing = '0px'
}

/** Pintura na moldura do estilo, com a plaqueta da feira embaixo. */
export async function comporMoldura(pintura: Blob, estiloId: string): Promise<Blob> {
  const [img, logo] = await Promise.all([abrirImagem(pintura), carregarLogo()])
  const d = desenhoDe(estiloId)
  const g = calcularGeometria(img.naturalWidth, img.naturalHeight, estiloId)

  const canvas = document.createElement('canvas')
  canvas.width = g.largura
  canvas.height = g.altura
  const ctx = canvas.getContext('2d')!

  d.painel(ctx, g.painel, g.m)

  // Filete em volta da pintura, com sombra no painel.
  const filete = Math.max(2, Math.round(g.m * 0.008))
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
  ctx.shadowBlur = g.m * 0.012
  ctx.shadowOffsetY = g.m * 0.004
  ctx.fillStyle = d.filete
  ctx.fillRect(g.pintura.x - filete, g.pintura.y - filete, g.pintura.w + 2 * filete, g.pintura.h + 2 * filete)
  ctx.restore()
  ctx.drawImage(img, g.pintura.x, g.pintura.y, g.pintura.w, g.pintura.h)

  desenharPlaca(ctx, g, d, logo)
  desenharPerfil(ctx, { x: 0, y: 0, w: g.largura, h: g.altura }, d.perfil, g.b)
  if (d.enfeites) {
    // Enfeites só no travessão, nunca sobre o painel.
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, g.largura, g.altura)
    ctx.rect(g.painel.x, g.painel.y, g.painel.w, g.painel.h)
    ctx.clip('evenodd')
    d.enfeites(ctx, g, d)
    ctx.restore()
  }

  return canvasParaJpeg(canvas, 0.9)
}
