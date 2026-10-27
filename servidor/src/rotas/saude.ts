import type { FastifyInstance } from 'fastify'
import type { Dependencias } from '../app.js'

export function rotaDeSaude(app: FastifyInstance, { config, teto, fila }: Dependencias): void {
  app.get('/api/saude', async () => ({
    ok: true,
    eventoAtivo: config.eventoAtivo,
    pinturasHoje: teto.gravadasHoje(),
    tetoDiario: config.tetoDiario,
    fila: fila.tamanho(),
  }))
}
