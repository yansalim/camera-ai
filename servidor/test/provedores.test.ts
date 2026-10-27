import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'
import { lerConfig } from '../src/config.js'
import { criarProvedorFalso } from '../src/provedores/falso.js'
import { criarProvedor } from '../src/provedores/index.js'
import { comNovaTentativa } from '../src/provedores/nova-tentativa.js'
import { montarPrompt } from '../src/provedores/prompt.js'
import { ErroRecusa, ErroTemporario, type Provedor } from '../src/provedores/tipos.js'
import { estiloDeTeste as estilo, gerarJpeg } from './ajudantes.js'

/** Provedor que responde, chamada a chamada, com o que estiver na lista (Error = rejeita). */
function provedorRoteirizado(respostas: Array<Buffer | Error>) {
  const pintar = vi.fn(async () => {
    const r = respostas.shift()
    if (r === undefined) throw new Error('chamada a mais')
    if (r instanceof Error) throw r
    return r
  })
  const p: Provedor = { nome: 'roteiro', modelo: 'r-1', pintar }
  return { p, pintar }
}

describe('montarPrompt', () => {
  it('junta o prompt do estilo com a instrução fixa', () => {
    const p = montarPrompt(estilo, false)
    expect(p).toContain(estilo.prompt)
    expect(p).toContain('recognizable')
    expect(p).not.toContain('second image')
  })

  it('menciona a referência quando há', () => {
    expect(montarPrompt(estilo, true)).toContain('second image')
  })
})

describe('comNovaTentativa', () => {
  const ok = Buffer.from('pintura')

  it('temporário uma vez e depois sucesso', async () => {
    const { p, pintar } = provedorRoteirizado([new ErroTemporario('503'), ok])
    await expect(comNovaTentativa(p).pintar(Buffer.from('foto'), estilo)).resolves.toBe(ok)
    expect(pintar).toHaveBeenCalledTimes(2)
  })

  it('temporário duas vezes propaga ErroTemporario', async () => {
    const { p, pintar } = provedorRoteirizado([new ErroTemporario('503'), new ErroTemporario('503')])
    await expect(comNovaTentativa(p).pintar(Buffer.from('foto'), estilo)).rejects.toBeInstanceOf(ErroTemporario)
    expect(pintar).toHaveBeenCalledTimes(2)
  })

  it('recusa não repete', async () => {
    const { p, pintar } = provedorRoteirizado([new ErroRecusa('filtro'), ok])
    await expect(comNovaTentativa(p).pintar(Buffer.from('foto'), estilo)).rejects.toBeInstanceOf(ErroRecusa)
    expect(pintar).toHaveBeenCalledTimes(1)
  })

  it('erro genérico não repete', async () => {
    const { p, pintar } = provedorRoteirizado([new Error('400'), ok])
    await expect(comNovaTentativa(p).pintar(Buffer.from('foto'), estilo)).rejects.toThrow('400')
    expect(pintar).toHaveBeenCalledTimes(1)
  })

  it('mantém nome e modelo do provedor embrulhado', () => {
    const { p } = provedorRoteirizado([])
    expect(comNovaTentativa(p)).toMatchObject({ nome: 'roteiro', modelo: 'r-1' })
  })
})

describe('provedor falso', () => {
  it('devolve JPEG com as mesmas dimensões', async () => {
    const m = await sharp(await criarProvedorFalso().pintar(await gerarJpeg(640, 480), estilo)).metadata()
    expect(m).toMatchObject({ format: 'jpeg', width: 640, height: 480 })
  })

  it('se identifica como falso', () => {
    expect(criarProvedorFalso()).toMatchObject({ nome: 'falso', modelo: 'falso-1' })
  })
})

describe('criarProvedor', () => {
  it('recusa provedor desconhecido', () => {
    expect(() => criarProvedor({ ...lerConfig({}), provedor: 'xyz' })).toThrow('Provedor desconhecido: xyz')
  })

  it('cria o vertex pela config, com o modelo escolhido', () => {
    const config = lerConfig({ PROVEDOR: 'vertex', GOOGLE_CLOUD_PROJECT: 'p', MODELO_IMAGEM: 'gemini-nano-banana-2.1' })
    expect(criarProvedor(config)).toMatchObject({ nome: 'vertex', modelo: 'gemini-nano-banana-2.1' })
  })

  it('cria o falso pela config', () => {
    expect(criarProvedor(lerConfig({}))).toMatchObject({ nome: 'falso' })
  })
})
