import { ErroTemporario, type Provedor } from './tipos.js'

/** Repete a chamada uma vez quando a falha é temporária; recusas e outros erros sobem direto. */
export function comNovaTentativa(p: Provedor): Provedor {
  return {
    nome: p.nome,
    modelo: p.modelo,
    async pintar(foto, estilo) {
      try {
        return await p.pintar(foto, estilo)
      } catch (e) {
        if (!(e instanceof ErroTemporario)) throw e
        return p.pintar(foto, estilo)
      }
    },
  }
}
