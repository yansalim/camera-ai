import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import sharp from 'sharp'
import { criarAcervo, type Acervo } from '../src/acervo/acervo.js'
import { dataLocal } from '../src/acervo/codigo.js'
import { construirApp, type Dependencias } from '../src/app.js'
import { lerConfig, type Config } from '../src/config.js'
import { carregarCatalogo, type Estilo } from '../src/estilos/catalogo.js'
import { criarFila } from '../src/protecao/fila.js'
import { criarLimitador } from '../src/protecao/limitador.js'
import { criarTetoDiario } from '../src/protecao/teto-diario.js'
import { criarProvedorFalso } from '../src/provedores/falso.js'
import { comNovaTentativa } from '../src/provedores/nova-tentativa.js'
import type { Provedor } from '../src/provedores/tipos.js'

export const estiloDeTeste: Estilo = {
  id: 'teste',
  nome: 'Teste',
  legenda: 'Legenda',
  prompt: 'Repaint this photo in a test style.',
  frases: ['Pintando…'],
  ordem: 1,
  ativo: true,
  caminhoMiniatura: '/nao/existe/miniatura.jpg',
}

/** JPEG colorido (gradiente) com as dimensões pedidas. */
export async function gerarJpeg(largura: number, altura: number): Promise<Buffer> {
  const pixels = Buffer.alloc(largura * altura * 3)
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = (y * largura + x) * 3
      pixels[i] = (x * 255) / largura
      pixels[i + 1] = (y * 255) / altura
      pixels[i + 2] = 128
    }
  }
  return sharp(pixels, { raw: { width: largura, height: altura, channels: 3 } }).jpeg().toBuffer()
}


/** App completo com os estilos reais, acervo em pasta temporária, provedor falso e evento ligado. */
export async function criarAppDeTeste(
  sobrescritas: { config?: Partial<Config>; provedor?: Provedor; acervo?: Acervo } = {},
): Promise<{ app: FastifyInstance; acervoDir: string; deps: Dependencias }> {
  const acervoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acervo-app-'))
  const config: Config = { ...lerConfig({}), eventoAtivo: true, estilosDir: path.resolve('../estilos'), acervoDir, ...sobrescritas.config }
  const deps: Dependencias = {
    config,
    catalogo: carregarCatalogo(config.estilosDir, () => {}),
    provedor: comNovaTentativa(sobrescritas.provedor ?? criarProvedorFalso()),
    acervo: sobrescritas.acervo ?? criarAcervo({ dir: acervoDir }),
    limitadorAparelho: criarLimitador(config.limiteAparelho),
    limitadorIp: criarLimitador(config.limiteIp),
    teto: criarTetoDiario({ teto: config.tetoDiario, contagemInicial: 0, hoje: () => dataLocal(new Date()) }),
    fila: criarFila(config.concorrencia),
  }
  const app = construirApp(deps)
  await app.ready()
  return { app, acervoDir, deps }
}

/** Corpo multipart/form-data na ordem dos campos; Buffer vira o arquivo foto.jpg. */
export async function montarFormulario(campos: Record<string, string | Buffer>): Promise<{ payload: Buffer; headers: Record<string, string> }> {
  const fronteira = '----pintor' + Math.random().toString(16).slice(2)
  const partes: Buffer[] = []
  for (const [nome, valor] of Object.entries(campos)) {
    const cabecalho =
      typeof valor === 'string'
        ? `Content-Disposition: form-data; name="${nome}"\r\n\r\n`
        : `Content-Disposition: form-data; name="${nome}"; filename="foto.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
    partes.push(Buffer.from(`--${fronteira}\r\n${cabecalho}`), typeof valor === 'string' ? Buffer.from(valor) : valor, Buffer.from('\r\n'))
  }
  partes.push(Buffer.from(`--${fronteira}--\r\n`))
  return { payload: Buffer.concat(partes), headers: { 'content-type': `multipart/form-data; boundary=${fronteira}` } }
}
