import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { carregarCatalogo } from '../src/estilos/catalogo.js'

const valido = (extra: Record<string, unknown> = {}) => ({
  nome: 'Teste',
  legenda: 'Legenda',
  prompt: 'Repaint this photo.',
  frases: ['Pintando…'],
  ordem: 1,
  ativo: true,
  ...extra,
})

let dir: string
let avisar: ReturnType<typeof vi.fn<(msg: string) => void>>

function criarEstilo(id: string, json: unknown, opcoes: { miniatura?: boolean; referencia?: boolean } = {}) {
  const pasta = path.join(dir, id)
  fs.mkdirSync(pasta)
  fs.writeFileSync(path.join(pasta, 'estilo.json'), typeof json === 'string' ? json : JSON.stringify(json))
  if (opcoes.miniatura !== false) fs.writeFileSync(path.join(pasta, 'miniatura.jpg'), 'jpg')
  if (opcoes.referencia) fs.writeFileSync(path.join(pasta, 'referencia.jpg'), 'jpg')
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estilos-'))
  avisar = vi.fn<(msg: string) => void>()
})

describe('carregarCatalogo', () => {
  it('carrega estilos válidos em ordem e esconde inativos', () => {
    criarEstilo('b', valido({ ordem: 2 }))
    criarEstilo('a', valido({ ordem: 1 }))
    criarEstilo('c', valido({ ordem: 3, ativo: false }))
    const cat = carregarCatalogo(dir, avisar)
    expect(cat.ativos().map(e => e.id)).toEqual(['a', 'b'])
    expect(cat.buscar('c')).toBeUndefined()
    expect(cat.buscar('a')?.caminhoMiniatura).toBe(path.join(dir, 'a', 'miniatura.jpg'))
  })

  it('ignora pasta sem miniatura e avisa', () => {
    criarEstilo('sem-miniatura', valido(), { miniatura: false })
    criarEstilo('ok', valido())
    const cat = carregarCatalogo(dir, avisar)
    expect(cat.ativos().map(e => e.id)).toEqual(['ok'])
    expect(avisar).toHaveBeenCalledWith(expect.stringContaining('sem-miniatura'))
  })

  it('ignora estilo.json malformado e avisa', () => {
    criarEstilo('quebrado', '{ "nome": ')
    const cat = carregarCatalogo(dir, avisar)
    expect(cat.ativos()).toEqual([])
    expect(avisar).toHaveBeenCalledWith(expect.stringContaining('Estilo "quebrado" ignorado'))
  })

  it('ignora estilo.json sem campo obrigatório (prompt)', () => {
    const { prompt: _, ...semPrompt } = valido()
    criarEstilo('sem-prompt', semPrompt)
    const cat = carregarCatalogo(dir, avisar)
    expect(cat.buscar('sem-prompt')).toBeUndefined()
    expect(avisar).toHaveBeenCalledWith(expect.stringContaining('Estilo "sem-prompt" ignorado'))
  })

  it('preenche caminhoReferencia só quando referencia.jpg existe', () => {
    criarEstilo('com', valido(), { referencia: true })
    criarEstilo('sem', valido())
    const cat = carregarCatalogo(dir, avisar)
    expect(cat.buscar('com')?.caminhoReferencia).toBe(path.join(dir, 'com', 'referencia.jpg'))
    expect(cat.buscar('sem')?.caminhoReferencia).toBeUndefined()
  })

  it('ignora estilo.json com frases vazias ou que não são texto', () => {
    criarEstilo('vazias', valido({ frases: [] }))
    criarEstilo('numero', valido({ frases: [1] }))
    const cat = carregarCatalogo(dir, avisar)
    expect(cat.ativos()).toEqual([])
    expect(avisar).toHaveBeenCalledWith(expect.stringContaining('Estilo "vazias" ignorado'))
    expect(avisar).toHaveBeenCalledWith(expect.stringContaining('Estilo "numero" ignorado'))
  })

  // Marco 1 (protótipo): só a Mona Lisa. No Marco 2 volta a esperar os 6 estilos na ordem.
  it('o catálogo real tem a Mona Lisa', () => {
    const cat = carregarCatalogo(path.resolve('../estilos'), avisar)
    expect(cat.ativos().map(e => e.id)).toEqual(['mona-lisa'])
    expect(cat.buscar('mona-lisa')).toMatchObject({ nome: 'Mona Lisa', legenda: 'Leonardo da Vinci' })
    expect(avisar).not.toHaveBeenCalled()
  })
})
