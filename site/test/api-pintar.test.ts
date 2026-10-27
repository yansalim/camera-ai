import { afterEach, describe, expect, it, vi } from 'vitest'
import { pintar } from '../src/api'

/** XMLHttpRequest de mentira: o teste decide quando o envio termina e quando a resposta chega. */
class XhrFalso {
  static ultimo: XhrFalso
  status = 0
  response: Blob | null = null
  responseType = ''
  abortado = false
  private ouvintes: Record<string, Array<() => void>> = {}
  private ouvintesEnvio: Record<string, Array<() => void>> = {}
  private cabecalhos: Record<string, string> = {}
  upload = { addEventListener: (tipo: string, f: () => void) => (this.ouvintesEnvio[tipo] ??= []).push(f) }
  constructor() {
    XhrFalso.ultimo = this
  }
  open() {}
  setRequestHeader() {}
  send() {}
  abort() {
    this.abortado = true
  }
  addEventListener(tipo: string, f: () => void) {
    ;(this.ouvintes[tipo] ??= []).push(f)
  }
  getResponseHeader(nome: string) {
    return this.cabecalhos[nome.toLowerCase()] ?? null
  }
  terminarEnvio() {
    this.ouvintesEnvio.load?.forEach(f => f())
  }
  responder(status: number, corpo: Blob, cabecalhos: Record<string, string> = {}) {
    this.status = status
    this.response = corpo
    this.cabecalhos = cabecalhos
    this.ouvintes.load?.forEach(f => f())
  }
  falharRede() {
    this.ouvintes.error?.forEach(f => f())
  }
}

const dados = {
  foto: new Blob(['foto'], { type: 'image/jpeg' }),
  estiloId: 'mona-lisa',
  aceite: { termosVersao: 'v1', aceiteEm: '2026-11-20T15:00:00.000Z' },
  idAparelho: 'aparelho-1',
}
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))

afterEach(() => vi.unstubAllGlobals())

describe('pintar (tempos limite e erros de rede)', () => {
  it('envio que não termina estoura no tempo do envio', async () => {
    vi.stubGlobal('XMLHttpRequest', XhrFalso)
    const r = pintar(dados, { tempoEnvioMs: 50, tempoTotalMs: 1000 })
    await expect(r).rejects.toMatchObject({ codigo: 'TEMPO_ESGOTADO', message: 'Demorou mais que o normal. Tente de novo.' })
    expect(XhrFalso.ultimo.abortado).toBe(true)
  })

  it('envio concluído e resposta pendente: só estoura no tempo total', async () => {
    vi.stubGlobal('XMLHttpRequest', XhrFalso)
    let resultado: unknown = 'pendente'
    const r = pintar(dados, { tempoEnvioMs: 50, tempoTotalMs: 250 })
    r.catch(e => {
      resultado = e
    })
    XhrFalso.ultimo.terminarEnvio()
    await esperar(120)
    expect(resultado).toBe('pendente')
    await expect(r).rejects.toMatchObject({ codigo: 'TEMPO_ESGOTADO' })
  })

  it('erro de rede vira SEM_INTERNET', async () => {
    vi.stubGlobal('XMLHttpRequest', XhrFalso)
    const r = pintar(dados, { tempoEnvioMs: 1000, tempoTotalMs: 1000 })
    XhrFalso.ultimo.falharRede()
    await expect(r).rejects.toMatchObject({ codigo: 'SEM_INTERNET', message: 'Parece que a internet caiu. Tente de novo.' })
  })

  it('resposta 200 traz a imagem e o código da obra', async () => {
    vi.stubGlobal('XMLHttpRequest', XhrFalso)
    const imagem = new Blob(['pintura'], { type: 'image/jpeg' })
    const r = pintar(dados, { tempoEnvioMs: 1000, tempoTotalMs: 1000 })
    XhrFalso.ultimo.terminarEnvio()
    XhrFalso.ultimo.responder(200, imagem, { 'x-codigo-obra': 'K7M-3PX' })
    await expect(r).resolves.toEqual({ imagem, codigo: 'K7M-3PX' })
  })

  it('resposta de erro usa o JSON do servidor', async () => {
    vi.stubGlobal('XMLHttpRequest', XhrFalso)
    const r = pintar(dados, { tempoEnvioMs: 1000, tempoTotalMs: 1000 })
    XhrFalso.ultimo.responder(429, new Blob(['{"erro":"TETO_DIARIO","mensagem":"A pintora foi descansar. Volte amanhã!"}']))
    await expect(r).rejects.toMatchObject({ codigo: 'TETO_DIARIO', message: 'A pintora foi descansar. Volte amanhã!' })
  })
})
