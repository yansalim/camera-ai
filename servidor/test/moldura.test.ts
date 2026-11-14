import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { criarAppDeTeste, gerarJpeg, montarFormulario } from './ajudantes.js'

type Contexto = Awaited<ReturnType<typeof criarAppDeTeste>>

let FOTO: Buffer
let MOLDURA: Buffer
beforeAll(async () => {
  FOTO = await gerarJpeg(640, 480)
  MOLDURA = await gerarJpeg(900, 1200)
})

let abertos: Contexto[] = []
afterEach(async () => {
  await Promise.all(abertos.map(c => c.app.close()))
  abertos = []
})
async function preparar(): Promise<Contexto> {
  const ctx = await criarAppDeTeste()
  abertos.push(ctx)
  return ctx
}

async function pintar(ctx: Contexto) {
  const form = await montarFormulario({ estiloId: 'mona-lisa', termosVersao: 'v1', aceiteEm: '2026-11-20T14:59:00.000Z', foto: FOTO })
  const r = await ctx.app.inject({ method: 'POST', url: '/api/pintar', payload: form.payload, headers: { ...form.headers, 'x-aparelho': 'aparelho-1' } })
  expect(r.statusCode).toBe(200)
  return { codigo: r.headers['x-codigo-obra'] as string, chave: r.headers['x-chave-moldura'] as string }
}

async function enviarMoldura(ctx: Contexto, campos: Record<string, string | Buffer>) {
  const form = await montarFormulario(campos)
  return ctx.app.inject({ method: 'POST', url: '/api/moldura', payload: form.payload, headers: form.headers })
}

async function pastaDaObra(acervoDir: string, codigo: string): Promise<string> {
  for (const dia of await fs.readdir(acervoDir)) {
    const p = path.join(acervoDir, dia, codigo)
    if (await fs.access(p).then(() => true, () => false)) return p
  }
  throw new Error(`obra ${codigo} não encontrada`)
}

describe('POST /api/moldura', () => {
  it('a pintura devolve uma chave para enviar a moldura', async () => {
    const ctx = await preparar()
    const { codigo, chave } = await pintar(ctx)
    expect(codigo).toBeTruthy()
    expect(chave).toMatch(/^[0-9a-f]{64}$/)
  })

  it('grava moldura.jpg na pasta da obra, ao lado da original e da pintura', async () => {
    const ctx = await preparar()
    const { codigo, chave } = await pintar(ctx)
    const r = await enviarMoldura(ctx, { codigo, chave, moldura: MOLDURA })
    expect(r.statusCode).toBe(204)
    const pasta = await pastaDaObra(ctx.acervoDir, codigo)
    expect((await fs.readdir(pasta)).sort()).toEqual(['info.json', 'moldura.jpg', 'original.jpg', 'pintura.jpg'])
    const meta = await sharp(path.join(pasta, 'moldura.jpg')).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 900, 1200])
  })

  it('recusa chave errada e não grava nada', async () => {
    const ctx = await preparar()
    const { codigo, chave } = await pintar(ctx)
    const errada = chave.replace(/^./, c => (c === '0' ? '1' : '0'))
    const r = await enviarMoldura(ctx, { codigo, chave: errada, moldura: MOLDURA })
    expect(r.statusCode).toBe(403)
    expect(r.json().erro).toBe('MOLDURA_RECUSADA')
    expect(await fs.readdir(await pastaDaObra(ctx.acervoDir, codigo))).not.toContain('moldura.jpg')
  })

  it('a chave de uma obra não vale para outra', async () => {
    const ctx = await preparar()
    const a = await pintar(ctx)
    const b = await pintar(ctx)
    const r = await enviarMoldura(ctx, { codigo: b.codigo, chave: a.chave, moldura: MOLDURA })
    expect(r.statusCode).toBe(403)
  })

  it('a chave vale uma vez só', async () => {
    const ctx = await preparar()
    const { codigo, chave } = await pintar(ctx)
    expect((await enviarMoldura(ctx, { codigo, chave, moldura: MOLDURA })).statusCode).toBe(204)
    expect((await enviarMoldura(ctx, { codigo, chave, moldura: MOLDURA })).statusCode).toBe(403)
  })

  it('recusa arquivo que não é imagem e deixa tentar de novo com a mesma chave', async () => {
    const ctx = await preparar()
    const { codigo, chave } = await pintar(ctx)
    const r = await enviarMoldura(ctx, { codigo, chave, moldura: Buffer.from('não é imagem') })
    expect(r.statusCode).toBe(400)
    expect((await enviarMoldura(ctx, { codigo, chave, moldura: MOLDURA })).statusCode).toBe(204)
  })

  it('recusa pedido sem chave ou com código fora do formato', async () => {
    const ctx = await preparar()
    const { codigo } = await pintar(ctx)
    expect((await enviarMoldura(ctx, { codigo, moldura: MOLDURA })).statusCode).toBe(403)
    expect((await enviarMoldura(ctx, { codigo: '../../x', chave: 'a'.repeat(64), moldura: MOLDURA })).statusCode).toBe(403)
  })
})
