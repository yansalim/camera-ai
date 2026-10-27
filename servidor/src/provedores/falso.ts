import { setTimeout as esperar } from 'node:timers/promises'
import sharp from 'sharp'
import type { Provedor } from './tipos.js'

/** Provedor de desenvolvimento e testes: devolve a própria foto saturada e desfocada, sem custo. */
export function criarProvedorFalso(opcoes: { atrasoMs?: number } = {}): Provedor {
  const atrasoMs = opcoes.atrasoMs ?? 0
  return {
    nome: 'falso',
    modelo: 'falso-1',
    async pintar(foto) {
      if (atrasoMs > 0) await esperar(atrasoMs)
      return sharp(foto).modulate({ saturation: 2 }).blur(2).jpeg().toBuffer()
    },
  }
}
