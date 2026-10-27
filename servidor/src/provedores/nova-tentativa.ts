import { ErroTemporario, type Provedor } from './tipos.js'

/** Repete a chamada uma vez quando a falha é temporária; recusas, outros erros e pedidos cancelados sobem direto. */
export function comNovaTentativa(p: Provedor): Provedor {
  return {
    nome: p.nome,
    modelo: p.modelo,
    async pintar(foto, estilo, sinal) {
      try {
        return await p.pintar(foto, estilo, sinal)
      } catch (e) {
        if (!(e instanceof ErroTemporario) || sinal?.aborted) throw e
        return p.pintar(foto, estilo, sinal)
      }
    },
  }
}
