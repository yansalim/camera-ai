import { readFile } from 'node:fs/promises'
import type { FastifyInstance } from 'fastify'
import type { Dependencias } from '../app.js'
import { corpoDoErro } from '../erros.js'

export function rotasDeEstilos(app: FastifyInstance, { catalogo }: Dependencias): void {
  // O prompt fica só no servidor.
  app.get('/api/estilos', async () =>
    catalogo.ativos().map(e => ({ id: e.id, nome: e.nome, legenda: e.legenda, frases: e.frases, miniaturaUrl: `/api/estilos/${e.id}/miniatura` })),
  )

  app.get<{ Params: { id: string } }>('/api/estilos/:id/miniatura', async (req, reply) => {
    const estilo = catalogo.buscar(req.params.id)
    if (!estilo) return reply.code(404).send(corpoDoErro('ESTILO_INVALIDO'))
    return reply.type('image/jpeg').header('cache-control', 'public, max-age=3600').send(await readFile(estilo.caminhoMiniatura))
  })
}
