import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import sharp from 'sharp'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Acervo } from '../src/acervo/acervo.js'
import { criarProvedorFalso } from '../src/provedores/falso.js'
import { ErroRecusa, ErroTemporario, type Provedor } from '../src/provedores/tipos.js'
import { criarAppDeTeste, gerarJpeg, montarFormulario } from './ajudantes.js'

type Contexto = Awaited<ReturnType<typeof criarAppDeTeste>>

const CODIGO = /^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/
let FOTO: Buffer
beforeAll(async () => {
  FOTO = await gerarJpeg(640, 480)
})

let abertos: Contexto[] = []
afterEach(async () => {
  await Promise.all(abertos.map(c => c.app.close()))
  abertos = []
})
async function preparar(...args: Parameters<typeof criarAppDeTeste>): Promise<Contexto> {
  const ctx = await criarAppDeTeste(...args)
  abertos.push(ctx)
  return ctx
}

/** POST /api/pintar com um pedido válido; `undefined` num campo o remove. */
async function pintar(ctx: Contexto, campos: Record<string, string | Buffer | undefined> = {}, cabecalhos: Record<string, string> = {}) {
  const todos = { estiloId: 'mona-lisa', termosVersao: 'v1', aceiteEm: '2026-11-20T14:59:00.000Z', foto: FOTO, ...campos }
  const presentes = Object.fromEntries(Object.entries(todos).filter(([, v]) => v !== undefined)) as Record<string, string | Buffer>
  const form = await montarFormulario(presentes)
  return ctx.app.inject({ method: 'POST', url: '/api/pintar', payload: form.payload, headers: { ...form.headers, 'x-aparelho': 'aparelho-1', ...cabecalhos } })
}

async function obras(acervoDir: string): Promise<string[]> {
  const caminhos: string[] = []
  for (const dia of await fs.readdir(acervoDir).catch(() => [])) {
    for (const obra of await fs.readdir(path.join(acervoDir, dia))) if (!obra.startsWith('.')) caminhos.push(path.join(acervoDir, dia, obra))
  }
  return caminhos
}
async function lerInfo(acervoDir: string, codigo: string) {
  const pasta = (await obras(acervoDir)).find(p => path.basename(p) === codigo)
  if (!pasta) throw new Error(`obra ${codigo} não encontrada`)
  return JSON.parse(await fs.readFile(path.join(pasta, 'info.json'), 'utf8'))
}

/** Provedor que responde, chamada a chamada, com a lista (Error = rejeita; depois do fim, sucesso). */
function roteiro(respostas: Array<Error | Buffer> = []): Provedor & { pintar: ReturnType<typeof vi.fn> } {
  const falso = criarProvedorFalso()
  const pintarFn = vi.fn(async (foto: Buffer, estilo: Parameters<Provedor['pintar']>[1]) => {
    const r = respostas.shift()
    if (r instanceof Error) throw r
    return r ?? falso.pintar(foto, estilo)
  })
  return { nome: 'falso', modelo: 'falso-1', pintar: pintarFn }
}

describe('POST /api/pintar', () => {
  it('sucesso: devolve JPEG, código e grava o acervo sem IP', async () => {
    const ctx = await preparar()
    const r = await pintar(ctx)
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toBe('image/jpeg')
    const codigo = r.headers['x-codigo-obra'] as string
    expect(codigo).toMatch(CODIGO)
    const info = await lerInfo(ctx.acervoDir, codigo)
    expect(info).toMatchObject({ estiloId: 'mona-lisa', estiloNome: 'Mona Lisa', provedor: 'falso', modelo: 'falso-1', termosVersao: 'v1', aceiteEm: '2026-11-20T14:59:00.000Z' })
    expect(info).not.toHaveProperty('ip')
    expect(JSON.stringify(info)).not.toContain('127.0.0.1')
    expect(ctx.deps.teto.gravadasHoje()).toBe(1)
  })

  it('evento desligado → 503 EVENTO_INATIVO sem chamar a IA', async () => {
    const provedor = roteiro()
    const r = await pintar(await preparar({ config: { eventoAtivo: false }, provedor }))
    expect(r.statusCode).toBe(503)
    expect(r.json()).toEqual({ erro: 'EVENTO_INATIVO', mensagem: 'Esta experiência está disponível no estande.' })
    expect(provedor.pintar).not.toHaveBeenCalled()
  })

  it('sem aceite → 400 ACEITE_AUSENTE', async () => {
    const ctx = await preparar()
    expect((await pintar(ctx, { termosVersao: undefined })).json().erro).toBe('ACEITE_AUSENTE')
    expect((await pintar(ctx, { aceiteEm: 'ontem' })).json().erro).toBe('ACEITE_AUSENTE')
  })

  it('estilo inexistente → 400 ESTILO_INVALIDO', async () => {
    const r = await pintar(await preparar(), { estiloId: 'nao-existe' })
    expect(r.statusCode).toBe(400)
    expect(r.json().erro).toBe('ESTILO_INVALIDO')
  })

  it('foto que não é imagem → 400 FOTO_INVALIDA', async () => {
    const r = await pintar(await preparar(), { foto: Buffer.from('não sou imagem') })
    expect(r.statusCode).toBe(400)
    expect(r.json().erro).toBe('FOTO_INVALIDA')
  })

  it('pedido sem foto ou sem multipart → 400 FOTO_INVALIDA', async () => {
    const ctx = await preparar()
    expect((await pintar(ctx, { foto: undefined })).json().erro).toBe('FOTO_INVALIDA')
    const r = await ctx.app.inject({ method: 'POST', url: '/api/pintar', payload: { estiloId: 'mona-lisa' } })
    expect(r.statusCode).toBe(400)
    expect(r.json().erro).toBe('FOTO_INVALIDA')
  })

  it('foto de 6 MB → 400 FOTO_INVALIDA', async () => {
    const r = await pintar(await preparar(), { foto: Buffer.alloc(6 * 1024 * 1024, 1) })
    expect(r.statusCode).toBe(400)
    expect(r.json().erro).toBe('FOTO_INVALIDA')
  })

  it('campo de texto gigante → 400 FOTO_INVALIDA', async () => {
    const r = await pintar(await preparar(), { estiloId: 'x'.repeat(10_000) })
    expect(r.statusCode).toBe(400)
    expect(r.json().erro).toBe('FOTO_INVALIDA')
  })

  it('campos demais → 400 FOTO_INVALIDA', async () => {
    const extras = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`extra${i}`, 'x']))
    const r = await pintar(await preparar(), extras)
    expect(r.statusCode).toBe(400)
    expect(r.json().erro).toBe('FOTO_INVALIDA')
  })

  it('versão dos termos fora do formato → 400 ACEITE_AUSENTE', async () => {
    expect((await pintar(await preparar(), { termosVersao: 'qualquer coisa' })).json().erro).toBe('ACEITE_AUSENTE')
  })

  it('pedido inválido não consome o limite do aparelho', async () => {
    const ctx = await preparar({ config: { limiteAparelho: { max: 1, janelaMs: 60_000 } } })
    expect((await pintar(ctx, { estiloId: 'nao-existe' })).statusCode).toBe(400)
    expect((await pintar(ctx)).statusCode).toBe(200)
  })

  it('limite por aparelho → 429 LIMITE_APARELHO; outro aparelho passa', async () => {
    const ctx = await preparar({ config: { limiteAparelho: { max: 2, janelaMs: 60_000 } } })
    expect((await pintar(ctx)).statusCode).toBe(200)
    expect((await pintar(ctx)).statusCode).toBe(200)
    const r = await pintar(ctx)
    expect(r.statusCode).toBe(429)
    expect(r.json()).toEqual({ erro: 'LIMITE_APARELHO', mensagem: 'Calma, artista! Espere alguns minutinhos para pintar de novo.' })
    expect((await pintar(ctx, {}, { 'x-aparelho': 'aparelho-2' })).statusCode).toBe(200)
  })

  it('limite de IP usa o IP real vindo do proxy', async () => {
    const ctx = await preparar({ config: { limiteIp: { max: 1, janelaMs: 60_000 } } })
    expect((await pintar(ctx, {}, { 'x-forwarded-for': '1.1.1.1', 'x-aparelho': 'a' })).statusCode).toBe(200)
    expect((await pintar(ctx, {}, { 'x-forwarded-for': '2.2.2.2', 'x-aparelho': 'b' })).statusCode).toBe(200)
    expect((await pintar(ctx, {}, { 'x-forwarded-for': '1.1.1.1', 'x-aparelho': 'c' })).json().erro).toBe('LIMITE_IP')
  })

  it('sem X-Aparelho, o limite do aparelho usa o IP', async () => {
    const ctx = await preparar({ config: { limiteAparelho: { max: 1, janelaMs: 60_000 } } })
    const form = await montarFormulario({ estiloId: 'mona-lisa', termosVersao: 'v1', aceiteEm: '2026-11-20T14:59:00.000Z', foto: FOTO })
    const semAparelho = () => ctx.app.inject({ method: 'POST', url: '/api/pintar', payload: form.payload, headers: form.headers })
    expect((await semAparelho()).statusCode).toBe(200)
    expect((await semAparelho()).json().erro).toBe('LIMITE_APARELHO')
  })

  it('teto diário → 429 TETO_DIARIO', async () => {
    const ctx = await preparar({ config: { tetoDiario: 1 } })
    expect((await pintar(ctx)).statusCode).toBe(200)
    const r = await pintar(ctx, {}, { 'x-aparelho': 'outro' })
    expect(r.statusCode).toBe(429)
    expect(r.json().erro).toBe('TETO_DIARIO')
  })

  it('falha da IA devolve a vaga do teto', async () => {
    const ctx = await preparar({ config: { tetoDiario: 1 }, provedor: roteiro([new Error('HTTP 400: pedido ruim')]) })
    expect((await pintar(ctx)).json().erro).toBe('IA_INDISPONIVEL')
    expect((await pintar(ctx)).statusCode).toBe(200)
  })

  it('recusa → 422 RECUSADA, uma chamada, nada no acervo', async () => {
    const provedor = roteiro([new ErroRecusa('filtro')])
    const ctx = await preparar({ provedor })
    const r = await pintar(ctx)
    expect(r.statusCode).toBe(422)
    expect(r.json()).toEqual({ erro: 'RECUSADA', mensagem: 'Não consegui pintar essa foto. Que tal tentar outra?' })
    expect(provedor.pintar).toHaveBeenCalledTimes(1)
    expect(await obras(ctx.acervoDir)).toEqual([])
  })

  it('temporário duas vezes → 502 IA_INDISPONIVEL', async () => {
    const provedor = roteiro([new ErroTemporario('503'), new ErroTemporario('503')])
    const r = await pintar(await preparar({ provedor }))
    expect(r.statusCode).toBe(502)
    expect(r.json().erro).toBe('IA_INDISPONIVEL')
    expect(provedor.pintar).toHaveBeenCalledTimes(2)
  })

  it('tempo esgotado → 504 e resposta tardia não é gravada', async () => {
    const ctx = await preparar({ config: { tempoMaximoMs: 50 }, provedor: criarProvedorFalso({ atrasoMs: 200 }) })
    const r = await pintar(ctx)
    expect(r.statusCode).toBe(504)
    expect(r.json().erro).toBe('TEMPO_ESGOTADO')
    await esperar(300)
    expect(await obras(ctx.acervoDir)).toEqual([])
    expect(ctx.deps.teto.gravadasHoje()).toBe(0)
  })

  it('pedido que estoura o tempo esperando na fila não chama a IA depois', async () => {
    const chamadas: string[] = []
    const lento: Provedor = {
      nome: 'falso',
      modelo: 'falso-1',
      pintar: async foto => {
        chamadas.push('chamou')
        await esperar(300)
        return foto
      },
    }
    const ctx = await preparar({ config: { concorrencia: 1, tempoMaximoMs: 400 }, provedor: lento })
    const respostas = await Promise.all(['a', 'b', 'c'].map(aparelho => pintar(ctx, {}, { 'x-aparelho': aparelho })))
    expect(respostas.map(r => r.statusCode).sort()).toEqual([200, 504, 504])
    await esperar(700)
    // O 1º pinta; o 2º começa antes do tempo dele acabar; o 3º chega à vez já cancelado e não chama a IA.
    expect(chamadas).toHaveLength(2)
  })

  it('a vaga do teto só volta quando a IA termina, mesmo depois do tempo esgotado', async () => {
    let primeira = true
    const provedor: Provedor = {
      nome: 'falso',
      modelo: 'falso-1',
      pintar: async foto => {
        if (primeira) {
          primeira = false
          await esperar(300)
        }
        return foto
      },
    }
    const ctx = await preparar({ config: { tetoDiario: 1, tempoMaximoMs: 100 }, provedor })
    expect((await pintar(ctx, {}, { 'x-aparelho': 'a' })).json().erro).toBe('TEMPO_ESGOTADO')
    // A 1ª chamada ainda está rodando (e será paga): a vaga continua reservada.
    expect((await pintar(ctx, {}, { 'x-aparelho': 'b' })).json().erro).toBe('TETO_DIARIO')
    await esperar(350)
    expect((await pintar(ctx, {}, { 'x-aparelho': 'c' })).statusCode).toBe(200)
  })

  it('falha ao gravar o acervo ainda entrega a pintura', async () => {
    const acervo: Acervo = { gravar: async () => { throw new Error('disco cheio') }, contarHoje: async () => 0 }
    const r = await pintar(await preparar({ acervo }))
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toBe('image/jpeg')
    expect(r.headers['x-codigo-obra']).toBeUndefined()
  })

  it('saída PNG da IA vira JPEG', async () => {
    const png = await sharp(FOTO).png().toBuffer()
    const r = await pintar(await preparar({ provedor: roteiro([png]) }))
    expect(r.headers['content-type']).toBe('image/jpeg')
    expect((await sharp(r.rawPayload).metadata()).format).toBe('jpeg')
  })
})
