import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lerAceite, obterIdAparelho, registrarAceite } from '../src/aceite'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('aceite', () => {
  it('registra e lê o aceite da versão atual', () => {
    const a = registrarAceite(new Date('2026-11-20T15:00:00Z'))
    expect(a).toEqual({ termosVersao: 'v1', aceiteEm: '2026-11-20T15:00:00.000Z' })
    expect(lerAceite()).toEqual(a)
  })

  it('ignora aceite de versão antiga', () => {
    localStorage.setItem('aceite', JSON.stringify({ termosVersao: 'v0', aceiteEm: '2026-01-01T00:00:00.000Z' }))
    expect(lerAceite()).toBeNull()
  })

  it('ignora aceite corrompido', () => {
    localStorage.setItem('aceite', '{quebrado')
    expect(lerAceite()).toBeNull()
  })

  it('idAparelho é estável e tem formato de UUID', () => {
    const id = obterIdAparelho()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(obterIdAparelho()).toBe(id)
  })

  it('sem localStorage, aceite e id continuam funcionando em memória', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    const a = registrarAceite()
    expect(lerAceite()).toEqual(a)
    expect(obterIdAparelho()).toBe(obterIdAparelho())
  })
})
