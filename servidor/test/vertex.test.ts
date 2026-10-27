import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ApiError } from '@google/genai'
import { describe, expect, it, vi } from 'vitest'
import { classificarStatus } from '../src/provedores/http.js'
import { ErroRecusa, ErroTemporario } from '../src/provedores/tipos.js'
import { criarProvedorVertex, type GerarConteudo, interpretarVertex } from '../src/provedores/vertex.js'
import { estiloDeTeste } from './ajudantes.js'

const base64 = (s: string) => Buffer.from(s).toString('base64')

// Formato de GenerateContentResponse do @google/genai (candidates → content → parts → inlineData).
const respostaComImagem = {
  candidates: [{ content: { parts: [{ text: 'Aqui está.' }, { inlineData: { mimeType: 'image/png', data: base64('img') } }] }, finishReason: 'STOP' }],
}
const respostaBloqueada = { promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } }
const respostaImagemBloqueada = { candidates: [{ finishReason: 'IMAGE_SAFETY' }] }
const respostaSoTexto = { candidates: [{ content: { parts: [{ text: 'Não posso editar esta imagem.' }] }, finishReason: 'STOP' }] }

describe('classificarStatus', () => {
  it('429 e 503 são temporários, 400 não', () => {
    expect(classificarStatus(429, '')).toBeInstanceOf(ErroTemporario)
    expect(classificarStatus(503, '')).toBeInstanceOf(ErroTemporario)
    expect(classificarStatus(408, '')).toBeInstanceOf(ErroTemporario)
    expect(classificarStatus(400, '')).not.toBeInstanceOf(ErroTemporario)
  })

  it('401/403 pede novo login e não repete', () => {
    for (const status of [401, 403]) {
      const e = classificarStatus(status, '')
      expect(e).not.toBeInstanceOf(ErroTemporario)
      expect(e.message).toMatch(/refaça o login OAuth/)
    }
  })
})

describe('interpretarVertex', () => {
  it('extrai a imagem inline', () => {
    expect(interpretarVertex(respostaComImagem)).toEqual(Buffer.from('img'))
  })

  it('bloqueio de segurança vira recusa', () => {
    expect(() => interpretarVertex(respostaBloqueada)).toThrow(ErroRecusa)
    expect(() => interpretarVertex(respostaImagemBloqueada)).toThrow(ErroRecusa)
  })

  it('resposta só com texto vira recusa', () => {
    expect(() => interpretarVertex(respostaSoTexto)).toThrow(ErroRecusa)
  })
})

describe('criarProvedorVertex', () => {
  const opcoes = { projeto: 'p', local: 'global', modelo: 'gemini-nano-banana-2.1' }

  it('envia prompt, foto e referência, nessa ordem, pedindo só imagem', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ref-'))
    const caminhoReferencia = path.join(dir, 'referencia.jpg')
    fs.writeFileSync(caminhoReferencia, 'ref')
    const gerar = vi.fn<GerarConteudo>(async () => respostaComImagem)
    const p = criarProvedorVertex(opcoes, gerar)

    expect(await p.pintar(Buffer.from('foto'), { ...estiloDeTeste, caminhoReferencia })).toEqual(Buffer.from('img'))
    expect(p).toMatchObject({ nome: 'vertex', modelo: 'gemini-nano-banana-2.1' })
    const pedido = gerar.mock.calls[0][0]
    expect(pedido.model).toBe('gemini-nano-banana-2.1')
    expect(pedido.config).toMatchObject({ responseModalities: ['IMAGE'] })
    const [texto, foto, referencia] = pedido.contents[0].parts
    expect(texto.text).toContain(estiloDeTeste.prompt)
    expect(texto.text).toContain('second image')
    expect(foto.inlineData).toEqual({ mimeType: 'image/jpeg', data: base64('foto') })
    expect(referencia.inlineData).toEqual({ mimeType: 'image/jpeg', data: base64('ref') })
  })

  it('repassa o cancelamento e um tempo limite ao SDK', async () => {
    const gerar = vi.fn<GerarConteudo>(async () => respostaComImagem)
    const controle = new AbortController()
    await criarProvedorVertex(opcoes, gerar).pintar(Buffer.from('foto'), estiloDeTeste, controle.signal)
    const { config } = gerar.mock.calls[0][0]
    expect(config.abortSignal).toBe(controle.signal)
    expect(config.httpOptions?.timeout).toBeGreaterThan(0)
  })

  it('sem referência envia só a foto', async () => {
    const gerar = vi.fn<GerarConteudo>(async () => respostaComImagem)
    await criarProvedorVertex(opcoes, gerar).pintar(Buffer.from('foto'), estiloDeTeste)
    const parts = gerar.mock.calls[0][0].contents[0].parts
    expect(parts).toHaveLength(2)
    expect(parts[0].text).not.toContain('second image')
  })

  it('erro HTTP da API passa pela classificação de status', async () => {
    const gerar = vi.fn<GerarConteudo>(async () => { throw new ApiError({ message: 'quota', status: 429 }) })
    await expect(criarProvedorVertex(opcoes, gerar).pintar(Buffer.from('foto'), estiloDeTeste)).rejects.toBeInstanceOf(ErroTemporario)
  })

  it('login do Google ausente ou expirado pede novo login e não repete', async () => {
    for (const mensagem of [
      'Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.',
      'invalid_grant: reauth related error (invalid_rapt)',
    ]) {
      const gerar = vi.fn<GerarConteudo>(async () => {
        throw new Error(mensagem)
      })
      const erro = await criarProvedorVertex(opcoes, gerar).pintar(Buffer.from('foto'), estiloDeTeste).catch(e => e)
      expect(erro).not.toBeInstanceOf(ErroTemporario)
      expect(erro.message).toMatch(/refaça o login OAuth/)
    }
  })

  it('falha de rede vira temporária', async () => {
    const gerar = vi.fn<GerarConteudo>(async () => { throw new TypeError('fetch failed') })
    await expect(criarProvedorVertex(opcoes, gerar).pintar(Buffer.from('foto'), estiloDeTeste)).rejects.toBeInstanceOf(ErroTemporario)
  })
})
