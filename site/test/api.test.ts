import { describe, expect, it } from 'vitest'
import { ErroPintura, interpretarErro } from '../src/api'

describe('interpretarErro', () => {
  it('usa o JSON do servidor', () => {
    const e = interpretarErro(429, '{"erro":"LIMITE_APARELHO","mensagem":"Calma, artista! Espere alguns minutinhos para pintar de novo."}')
    expect(e).toBeInstanceOf(ErroPintura)
    expect(e.codigo).toBe('LIMITE_APARELHO')
    expect(e.message).toBe('Calma, artista! Espere alguns minutinhos para pintar de novo.')
  })

  it('com corpo estranho cai em IA_INDISPONIVEL', () => {
    const e = interpretarErro(502, '<html>')
    expect(e.codigo).toBe('IA_INDISPONIVEL')
    expect(e.message).toBe('A pintora está com dificuldades. Tente de novo.')
  })

  it('JSON sem os campos esperados também cai em IA_INDISPONIVEL', () => {
    expect(interpretarErro(500, '{"statusCode":500}').codigo).toBe('IA_INDISPONIVEL')
  })
})
