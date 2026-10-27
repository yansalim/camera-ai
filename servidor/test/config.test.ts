import { describe, expect, it } from 'vitest'
import { lerConfig } from '../src/config.js'

describe('lerConfig', () => {
  it('usa os padrões', () => {
    const c = lerConfig({})
    expect(c).toMatchObject({ porta: 3000, provedor: 'falso', eventoAtivo: false, tetoDiario: 1000, concorrencia: 5, tempoMaximoMs: 90_000 })
    expect(c.limiteAparelho).toEqual({ max: 5, janelaMs: 600_000 })
    expect(c.limiteIp).toEqual({ max: 60, janelaMs: 3_600_000 })
    expect(c.google).toEqual({ local: 'global' })
  })

  it('liga o evento só com "true"', () => {
    expect(lerConfig({ EVENTO_ATIVO: 'true' }).eventoAtivo).toBe(true)
    expect(lerConfig({ EVENTO_ATIVO: 'sim' }).eventoAtivo).toBe(false)
  })

  it('recusa número inválido citando a variável', () => {
    expect(() => lerConfig({ TETO_DIARIO: 'abc' })).toThrow('Variável TETO_DIARIO inválida: abc')
    expect(() => lerConfig({ CONCORRENCIA: '0' })).toThrow(/CONCORRENCIA/)
  })

  it('vertex exige projeto e modelo', () => {
    expect(() => lerConfig({ PROVEDOR: 'vertex', MODELO_IMAGEM: 'x' })).toThrow(/GOOGLE_CLOUD_PROJECT/)
    expect(() => lerConfig({ PROVEDOR: 'vertex', GOOGLE_CLOUD_PROJECT: 'p' })).toThrow(/MODELO_IMAGEM/)
    expect(lerConfig({ PROVEDOR: 'vertex', GOOGLE_CLOUD_PROJECT: 'p', MODELO_IMAGEM: 'm' }).google).toEqual({ projeto: 'p', local: 'global', modelo: 'm' })
  })
})
