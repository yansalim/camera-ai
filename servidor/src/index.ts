import { criarAcervo } from './acervo/acervo.js'
import { dataLocal } from './acervo/codigo.js'
import { construirApp } from './app.js'
import { lerConfig } from './config.js'
import { carregarCatalogo } from './estilos/catalogo.js'
import { criarFila } from './protecao/fila.js'
import { criarLimitador } from './protecao/limitador.js'
import { criarTetoDiario } from './protecao/teto-diario.js'
import { criarProvedor } from './provedores/index.js'

const config = lerConfig(process.env)
const avisos: string[] = []
const catalogo = carregarCatalogo(config.estilosDir, aviso => avisos.push(aviso))
const acervo = criarAcervo({ dir: config.acervoDir })
const provedor = criarProvedor(config)

const app = construirApp(
  {
    config,
    catalogo,
    provedor,
    acervo,
    limitadorAparelho: criarLimitador(config.limiteAparelho),
    limitadorIp: criarLimitador(config.limiteIp),
    teto: criarTetoDiario({ teto: config.tetoDiario, contagemInicial: await acervo.contarHoje(), hoje: () => dataLocal(new Date()) }),
    fila: criarFila(config.concorrencia),
  },
  { logger: true },
)

for (const aviso of avisos) app.log.warn(aviso)
app.log.info(
  { provedor: provedor.nome, modelo: provedor.modelo, estilos: catalogo.ativos().map(e => e.id), eventoAtivo: config.eventoAtivo },
  'pintor pronto',
)

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sinal, () => void app.close().then(() => process.exit(0)))
}

await app.listen({ host: '0.0.0.0', port: config.porta })
