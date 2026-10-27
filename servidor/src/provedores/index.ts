import type { Config } from '../config.js'
import { criarProvedorFalso } from './falso.js'
import { comNovaTentativa } from './nova-tentativa.js'
import type { Provedor } from './tipos.js'

/** Cria o provedor escolhido em PROVEDOR, já com a nova tentativa automática. */
export function criarProvedor(config: Config): Provedor {
  switch (config.provedor) {
    case 'falso':
      return comNovaTentativa(criarProvedorFalso())
    default:
      throw new Error(`Provedor desconhecido: ${config.provedor}`)
  }
}
