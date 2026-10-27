import { setTimeout as esperar } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { criarFila } from '../src/protecao/fila.js'
import { criarLimitador } from '../src/protecao/limitador.js'
import { criarTetoDiario } from '../src/protecao/teto-diario.js'

describe('limitador', () => {
  it('permite max na janela e bloqueia o seguinte', () => {
    const l = criarLimitador({ max: 5, janelaMs: 1000, agora: () => 0 })
    expect(Array.from({ length: 5 }, () => l.tentar('a'))).toEqual([true, true, true, true, true])
    expect(l.tentar('a')).toBe(false)
  })

  it('libera depois da janela', () => {
    let t = 0
    const l = criarLimitador({ max: 1, janelaMs: 1000, agora: () => t })
    expect(l.tentar('a')).toBe(true)
    t = 1000
    expect(l.tentar('a')).toBe(false)
    t = 1001
    expect(l.tentar('a')).toBe(true)
  })

  it('pedido bloqueado não ocupa vaga', () => {
    let t = 0
    const l = criarLimitador({ max: 1, janelaMs: 1000, agora: () => t })
    l.tentar('a')
    t = 500
    expect(l.tentar('a')).toBe(false)
    t = 1001
    expect(l.tentar('a')).toBe(true)
  })

  it('chaves são independentes', () => {
    const l = criarLimitador({ max: 1, janelaMs: 1000, agora: () => 0 })
    expect(l.tentar('a')).toBe(true)
    expect(l.tentar('b')).toBe(true)
    expect(l.tentar('a')).toBe(false)
  })
})

describe('teto diário', () => {
  const hoje = () => '2026-11-20'

  it('em andamento conta para o teto', () => {
    const t = criarTetoDiario({ teto: 2, contagemInicial: 1, hoje })
    expect(t.reservar()).toBe(true)
    expect(t.reservar()).toBe(false)
  })

  it('liberar devolve a vaga; confirmar soma em gravadasHoje', () => {
    const t = criarTetoDiario({ teto: 2, contagemInicial: 0, hoje })
    expect(t.reservar()).toBe(true)
    expect(t.reservar()).toBe(true)
    t.liberar()
    expect(t.gravadasHoje()).toBe(0)
    expect(t.reservar()).toBe(true)
    t.confirmar()
    expect(t.gravadasHoje()).toBe(1)
    expect(t.reservar()).toBe(false)
  })

  it('zera gravadas quando o dia muda', () => {
    let dia = '2026-11-20'
    const t = criarTetoDiario({ teto: 1, contagemInicial: 1, hoje: () => dia })
    expect(t.reservar()).toBe(false)
    dia = '2026-11-21'
    expect(t.gravadasHoje()).toBe(0)
    expect(t.reservar()).toBe(true)
  })
})

describe('fila', () => {
  it('nunca passa da concorrência e respeita a ordem', async () => {
    const fila = criarFila(3)
    let ativas = 0
    let pico = 0
    const inicios: number[] = []
    const resultados = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        fila.executar(async () => {
          inicios.push(i)
          ativas++
          pico = Math.max(pico, ativas)
          await esperar(5)
          ativas--
          return i * 2
        }),
      ),
    )
    expect(pico).toBe(3)
    expect(inicios).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(resultados).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18])
    expect(fila.tamanho()).toBe(0)
  })

  it('tamanho conta esperando + executando', async () => {
    const fila = criarFila(1)
    let soltar!: () => void
    const primeira = fila.executar(() => new Promise<void>(r => { soltar = r }))
    const segunda = fila.executar(async () => {})
    expect(fila.tamanho()).toBe(2)
    soltar()
    await Promise.all([primeira, segunda])
    expect(fila.tamanho()).toBe(0)
  })

  it('tarefa que falha libera a vaga', async () => {
    const fila = criarFila(1)
    await expect(fila.executar(async () => { throw new Error('x') })).rejects.toThrow('x')
    await expect(fila.executar(async () => 'ok')).resolves.toBe('ok')
  })
})
