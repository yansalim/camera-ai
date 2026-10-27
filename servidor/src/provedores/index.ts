import type { Config } from '../config.js'
import { criarProvedorFalso } from './falso.js'
import { comNovaTentativa } from './nova-tentativa.js'
import type { Provedor } from './tipos.js'
import { criarProvedorVertex } from './vertex.js'

/** Cria o provedor escolhido em PROVEDOR, já com a nova tentativa automática. */
export function criarProvedor(config: Config): Provedor {
  switch (config.provedor) {
    case 'falso':
      return comNovaTentativa(criarProvedorFalso())
    case 'vertex': {
      const { projeto, local, modelo } = config.google
      // lerConfig já exige os dois com PROVEDOR=vertex.
      if (!projeto || !modelo) throw new Error('PROVEDOR=vertex exige GOOGLE_CLOUD_PROJECT e MODELO_IMAGEM')
      return comNovaTentativa(criarProvedorVertex({ projeto, local, modelo }))
    }
    default:
      throw new Error(`Provedor desconhecido: ${config.provedor}`)
  }
}
