import multipart from '@fastify/multipart'
import Fastify, { type FastifyInstance, LogController } from 'fastify'
import type { Acervo } from './acervo/acervo.js'
import type { Config } from './config.js'
import { codigoDoErro, corpoDoErro, ERROS } from './erros.js'
import type { Catalogo } from './estilos/catalogo.js'
import type { Fila } from './protecao/fila.js'
import type { Limitador } from './protecao/limitador.js'
import type { TetoDiario } from './protecao/teto-diario.js'
import type { Provedor } from './provedores/tipos.js'
import { rotasDeEstilos } from './rotas/estilos.js'
import { rotaDePintura } from './rotas/pintar.js'
import { rotaDeSaude } from './rotas/saude.js'

export interface Dependencias {
  config: Config
  catalogo: Catalogo
  provedor: Provedor
  acervo: Acervo
  limitadorAparelho: Limitador
  limitadorIp: Limitador
  teto: TetoDiario
  fila: Fila
}

export function construirApp(deps: Dependencias, opcoes: { logger?: boolean } = {}): FastifyInstance {
  // trustProxy: atrás do Caddy, o IP do visitante vem em X-Forwarded-For.
  // Sem o log de pedidos padrão do Fastify, que grava o IP; o pintor registra os pedidos do seu jeito.
  const app = Fastify({
    trustProxy: true,
    logger: opcoes.logger ?? false,
    logController: new LogController({ disableRequestLogging: true }),
  })

  // Além da foto (5 MB), só três campos curtos: estiloId, termosVersao e aceiteEm.
  app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3, fieldSize: 200, parts: 4 } })

  app.setErrorHandler((erro, req, reply) => {
    const codigo = codigoDoErro(erro)
    if (codigo) return reply.code(ERROS[codigo].status).send(corpoDoErro(codigo))
    req.log.error({ err: erro }, 'erro inesperado')
    return reply.code(500).send(corpoDoErro('IA_INDISPONIVEL'))
  })

  rotasDeEstilos(app, deps)
  rotaDeSaude(app, deps)
  rotaDePintura(app, deps)
  return app
}
