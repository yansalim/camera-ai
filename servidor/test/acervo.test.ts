import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { criarAcervo, type RegistroObra } from '../src/acervo/acervo.js'
import { dataLocal, gerarCodigo } from '../src/acervo/codigo.js'

const registro: RegistroObra = {
  estiloId: 'mona-lisa',
  estiloNome: 'Mona Lisa',
  provedor: 'falso',
  modelo: 'falso-1',
  termosVersao: 'v1',
  aceiteEm: '2026-11-20T14:59:00.000Z',
}
const agora = () => new Date('2026-11-20T15:00:00Z')
const o = Buffer.from('o')
const p = Buffer.from('p')

/** Devolve os valores da lista em sequência; depois repete o último. */
const sequencia = (valores: number[]) => {
  let i = 0
  return () => valores[Math.min(i++, valores.length - 1)]
}

let dir: string
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acervo-'))
})

describe('código da obra', () => {
  it('gerarCodigo segue o formato e o alfabeto', () => {
    for (let i = 0; i < 200; i++) expect(gerarCodigo()).toMatch(/^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/)
  })

  it('gerarCodigo usa a fonte de aleatoriedade dada', () => {
    expect(gerarCodigo(() => 0)).toBe('222-222')
    expect(gerarCodigo(() => 0.9999)).toBe('ZZZ-ZZZ')
  })

  it('dataLocal usa o fuso de São Paulo', () => {
    expect(dataLocal(new Date('2026-11-21T02:30:00Z'))).toBe('2026-11-20')
    expect(dataLocal(new Date('2026-11-21T03:30:00Z'))).toBe('2026-11-21')
  })
})

describe('acervo', () => {
  it('gravar cria a pasta com os 3 arquivos', async () => {
    const acervo = criarAcervo({ dir, agora })
    const codigo = await acervo.gravar(o, p, registro)
    const pasta = path.join(dir, '2026-11-20', codigo)
    expect((await fs.readdir(pasta)).sort()).toEqual(['info.json', 'original.jpg', 'pintura.jpg'])
    expect(await fs.readFile(path.join(pasta, 'original.jpg'), 'utf8')).toBe('o')
    expect(await fs.readFile(path.join(pasta, 'pintura.jpg'), 'utf8')).toBe('p')
    const info = JSON.parse(await fs.readFile(path.join(pasta, 'info.json'), 'utf8'))
    expect(info).toEqual({ codigo, criadoEm: '2026-11-20T15:00:00.000Z', ...registro })
  })

  it('sorteia de novo se o código já existe', async () => {
    // 1ª obra: 6 sorteios "2"; 2ª obra: os mesmos 6 (colide) e depois outros.
    const acervo = criarAcervo({ dir, agora, aleatorio: sequencia([...Array(12).fill(0), 0.5]) })
    const c1 = await acervo.gravar(o, p, registro)
    const c2 = await acervo.gravar(o, p, registro)
    expect(c1).toBe('222-222')
    expect(c2).not.toBe(c1)
    expect(await fs.readdir(path.join(dir, '2026-11-20'))).toHaveLength(2)
  })

  it('código usado em outro dia também conta como colisão', async () => {
    await fs.mkdir(path.join(dir, '2026-11-19', '222-222'), { recursive: true })
    const acervo = criarAcervo({ dir, agora, aleatorio: sequencia([...Array(6).fill(0), 0.5]) })
    expect(await acervo.gravar(o, p, registro)).not.toBe('222-222')
  })

  it('contarHoje conta só as obras de hoje e ignora temporárias', async () => {
    await fs.mkdir(path.join(dir, '2026-11-19', 'AAA-AAA'), { recursive: true })
    await fs.mkdir(path.join(dir, '2026-11-20', 'BBB-BBB'), { recursive: true })
    await fs.mkdir(path.join(dir, '2026-11-20', '.tmp-CCC-CCC'), { recursive: true })
    expect(await criarAcervo({ dir, agora }).contarHoje()).toBe(1)
  })

  it('contarHoje é zero quando o acervo ainda não existe', async () => {
    expect(await criarAcervo({ dir: path.join(dir, 'nada'), agora }).contarHoje()).toBe(0)
  })
})
