import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import sharp from 'sharp'
import type { Dependencias } from '../app.js'
import { codigoDoErro, ErroApi } from '../erros.js'
import { ErroFotoInvalida, paraJpeg, prepararFoto } from '../imagem/imagem.js'
import { ErroRecusa } from '../provedores/tipos.js'

/** Lê campos e foto do multipart; os campos vêm antes do arquivo, mas a ordem não importa aqui. */
async function lerFormulario(req: FastifyRequest, campoArquivo = 'foto'): Promise<{ campos: Record<string, string>; foto?: Buffer }> {
  const campos: Record<string, string> = {}
  let foto: Buffer | undefined
  for await (const parte of req.parts()) {
    if (parte.type === 'file') {
      const conteudo = await parte.toBuffer()
      if (parte.fieldname === campoArquivo) foto = conteudo
    } else {
      // Valor maior que o limite de campo chega cortado: o pedido não é de um celular nosso.
      if (parte.valueTruncated || parte.fieldnameTruncated) throw new ErroApi('FOTO_INVALIDA')
      campos[parte.fieldname] = String(parte.value)
    }
  }
  return { campos, foto }
}

const aceiteValido = (termosVersao?: string, aceiteEm?: string) =>
  !!termosVersao && /^v\d+$/.test(termosVersao) && !!aceiteEm && /^\d{4}-\d{2}-\d{2}T/.test(aceiteEm) && !Number.isNaN(Date.parse(aceiteEm))

/** Tempo que o celular tem para mandar a moldura depois de receber a pintura. */
const VALIDADE_CHAVE_MS = 30 * 60 * 1000

/** A moldura é composta no celular; aqui só confere que é um JPEG de tamanho razoável e reencoda (sem metadados). */
async function validarMoldura(entrada: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(entrada).metadata()
    if (meta.format !== 'jpeg' || !meta.width || !meta.height || meta.width > 6000 || meta.height > 6000) throw new Error('formato')
    return await sharp(entrada).jpeg({ quality: 90 }).toBuffer()
  } catch {
    throw new ErroApi('FOTO_INVALIDA')
  }
}

const mesmaChave = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export function rotaDePintura(app: FastifyInstance, deps: Dependencias): void {
  const { config, catalogo, provedor, acervo, limitadorAparelho, limitadorIp, teto, fila } = deps
  // Chave de uso único por obra: só quem recebeu a pintura pode mandar a moldura dela.
  // Fica só na memória: se o pintor reiniciar no meio, aquela obra fica sem moldura no acervo.
  const chavesMoldura = new Map<string, { chave: string; expira: number }>()
  const novaChave = (codigo: string) => {
    const agora = Date.now()
    for (const [c, v] of chavesMoldura) if (v.expira < agora) chavesMoldura.delete(c)
    const chave = randomBytes(32).toString('hex')
    chavesMoldura.set(codigo, { chave, expira: agora + VALIDADE_CHAVE_MS })
    return chave
  }

  app.post('/api/pintar', async (req, reply) => {
    const inicio = Date.now()
    let estiloId: string | undefined
    let codigo: string | null = null
    const registrar = (resultado: string) =>
      req.log.info({ resultado, estiloId, codigo, duracaoMs: Date.now() - inicio, gravadasHoje: teto.gravadasHoje() }, 'pintura')

    try {
      // Ordem da Decisão 1: validar tudo antes de gastar limites.
      if (!config.eventoAtivo) throw new ErroApi('EVENTO_INATIVO')
      const { campos, foto } = await lerFormulario(req)
      if (!aceiteValido(campos.termosVersao, campos.aceiteEm)) throw new ErroApi('ACEITE_AUSENTE')
      const estilo = campos.estiloId ? catalogo.buscar(campos.estiloId) : undefined
      if (!estilo) throw new ErroApi('ESTILO_INVALIDO')
      estiloId = estilo.id // só um id do catálogo vai para o log
      if (!foto) throw new ErroApi('FOTO_INVALIDA')
      const original = await prepararFoto(foto).catch(e => {
        throw e instanceof ErroFotoInvalida ? new ErroApi('FOTO_INVALIDA') : e
      })

      const aparelho = req.headers['x-aparelho']
      if (!limitadorAparelho.tentar(typeof aparelho === 'string' && aparelho ? aparelho : req.ip)) throw new ErroApi('LIMITE_APARELHO')
      if (!limitadorIp.tentar(req.ip)) throw new ErroApi('LIMITE_IP')
      if (!teto.reservar()) throw new ErroApi('TETO_DIARIO')

      // Daqui em diante a vaga do teto está reservada: ou confirma, ou libera.
      let pintura: Buffer
      let relogio: NodeJS.Timeout | undefined
      const cancelamento = new AbortController()
      const trabalho = fila.executar(async () => {
        // Chegou a vez depois do tempo esgotado: o visitante já recebeu 504, então a IA não é chamada.
        if (cancelamento.signal.aborted) throw new ErroApi('TEMPO_ESGOTADO')
        return provedor.pintar(original, estilo, cancelamento.signal)
      })
      trabalho.catch(() => {}) // resposta tardia (depois do tempo esgotado) é descartada
      try {
        const tempo = new Promise<never>((_, rejeitar) => {
          relogio = setTimeout(() => {
            cancelamento.abort()
            rejeitar(new ErroApi('TEMPO_ESGOTADO'))
          }, config.tempoMaximoMs)
        })
        pintura = await paraJpeg(await Promise.race([trabalho, tempo]))
      } catch (e) {
        if (e instanceof ErroApi && e.codigo === 'TEMPO_ESGOTADO') {
          // A chamada ainda pode estar rodando (e ser cobrada): a vaga do teto só volta quando ela terminar.
          void trabalho.then(teto.liberar, teto.liberar)
          throw e
        }
        teto.liberar()
        if (e instanceof ErroApi) throw e
        if (e instanceof ErroRecusa) throw new ErroApi('RECUSADA')
        req.log.error({ err: e }, 'falha do provedor de IA')
        throw new ErroApi('IA_INDISPONIVEL')
      } finally {
        clearTimeout(relogio)
      }

      // A IA já foi paga: a pintura conta no teto mesmo se o acervo falhar (Decisão 4).
      teto.confirmar()
      try {
        codigo = await acervo.gravar(original, pintura, {
          estiloId: estilo.id,
          estiloNome: estilo.nome,
          provedor: provedor.nome,
          modelo: provedor.modelo,
          termosVersao: campos.termosVersao,
          aceiteEm: campos.aceiteEm,
        })
      } catch (e) {
        req.log.error({ err: e }, 'falha ao gravar no acervo; a pintura segue sem código')
      }

      registrar('ok')
      reply.type('image/jpeg')
      if (codigo) reply.header('x-codigo-obra', codigo).header('x-chave-moldura', novaChave(codigo))
      return reply.send(pintura)
    } catch (e) {
      registrar(codigoDoErro(e) ?? 'IA_INDISPONIVEL')
      throw e
    }
  })

  app.post('/api/moldura', async (req, reply) => {
    const { campos, foto } = await lerFormulario(req, 'moldura')
    const codigo = campos.codigo ?? ''
    const guardada = chavesMoldura.get(codigo)
    if (!guardada || guardada.expira < Date.now() || !mesmaChave(guardada.chave, campos.chave ?? '')) throw new ErroApi('MOLDURA_RECUSADA')
    if (!foto) throw new ErroApi('FOTO_INVALIDA')
    const moldura = await validarMoldura(foto)
    chavesMoldura.delete(codigo)
    if (!(await acervo.gravarMoldura(codigo, moldura))) throw new ErroApi('MOLDURA_RECUSADA')
    req.log.info({ codigo }, 'moldura gravada')
    return reply.code(204).send()
  })
}
