import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { ERROS } from '../src/erros.js'
import { criarAppDeTeste } from './ajudantes.js'

let fechar: Array<() => Promise<unknown>> = []
afterEach(async () => {
  await Promise.all(fechar.map(f => f()))
  fechar = []
})
async function app(...args: Parameters<typeof criarAppDeTeste>) {
  const r = await criarAppDeTeste(...args)
  fechar.push(() => r.app.close())
  return r.app
}

describe('erros', () => {
  it('ERROS tem os status e as mensagens da spec', () => {
    expect(ERROS.EVENTO_INATIVO.status).toBe(503)
    expect(ERROS.RECUSADA.status).toBe(422)
    expect(ERROS.TEMPO_ESGOTADO.status).toBe(504)
    expect(ERROS.ACEITE_AUSENTE.status).toBe(400)
    expect(ERROS.TETO_DIARIO.mensagem).toBe('A pintora foi descansar. Volte amanhã!')
    expect(ERROS.ESTILO_INVALIDO.mensagem).toBe('Esse estilo não está disponível. Escolha outro.')
  })
})

describe('rotas básicas', () => {
  // Marco 1: só a Mona Lisa. No Marco 2 espera 6 estilos, o primeiro sendo arte-grega.
  it('GET /api/estilos lista ativos sem expor o prompt', async () => {
    const r = await (await app()).inject('/api/estilos')
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual([
      {
        id: 'mona-lisa',
        nome: 'Mona Lisa',
        legenda: 'Leonardo da Vinci',
        frases: ['Esfumando as sombras…', 'Pintando a paisagem ao fundo…', 'Suavizando a luz…', 'Envelhecendo o verniz…'],
        miniaturaUrl: '/api/estilos/mona-lisa/miniatura',
      },
    ])
  })

  it('GET miniatura devolve JPEG com cache', async () => {
    const r = await (await app()).inject('/api/estilos/mona-lisa/miniatura')
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toBe('image/jpeg')
    expect(r.headers['cache-control']).toBe('public, max-age=3600')
    expect((await sharp(r.rawPayload).metadata()).format).toBe('jpeg')
  })

  it('miniatura de estilo inexistente dá 404 ESTILO_INVALIDO', async () => {
    const r = await (await app()).inject('/api/estilos/nao-existe/miniatura')
    expect(r.statusCode).toBe(404)
    expect(r.json()).toEqual({ erro: 'ESTILO_INVALIDO', mensagem: 'Esse estilo não está disponível. Escolha outro.' })
  })

  it('GET /api/saude', async () => {
    expect((await (await app()).inject('/api/saude')).json()).toEqual({ ok: true, eventoAtivo: true, pinturasHoje: 0, tetoDiario: 1000, fila: 0 })
  })

  it('saude mostra o interruptor desligado', async () => {
    expect((await (await app({ config: { eventoAtivo: false } })).inject('/api/saude')).json()).toMatchObject({ eventoAtivo: false })
  })
})
