import { readFile } from 'node:fs/promises'
import { ApiError, GoogleGenAI } from '@google/genai'
import sharp from 'sharp'
import type { Estilo } from '../estilos/catalogo.js'
import { classificarStatus, erroDeLogin } from './http.js'
import { montarPrompt, ROTULO_FOTO, ROTULO_REFERENCIA } from './prompt.js'
import { ErroRecusa, ErroTemporario, type Provedor } from './tipos.js'

interface Parte {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

export interface PedidoVertex {
  model: string
  contents: Array<{ role: 'user'; parts: Parte[] }>
  config: {
    responseModalities: string[]
    imageConfig?: { aspectRatio: string }
    abortSignal?: AbortSignal
    httpOptions?: { timeout?: number }
  }
}

/** Chamada ao modelo; em produção é `ai.models.generateContent`, nos testes um dublê. */
export type GerarConteudo = (pedido: PedidoVertex) => Promise<unknown>

interface RespostaVertex {
  promptFeedback?: { blockReason?: string }
  candidates?: Array<{ finishReason?: string; content?: { parts?: Parte[] } }>
}

/** Tira a primeira imagem da resposta; bloqueio de segurança ou resposta sem imagem viram ErroRecusa. */
export function interpretarVertex(resposta: unknown): Buffer {
  const r = (resposta ?? {}) as RespostaVertex
  const bloqueio = r.promptFeedback?.blockReason
  if (bloqueio) throw new ErroRecusa(`Pedido bloqueado pelo provedor: ${bloqueio}`)
  const candidato = r.candidates?.[0]
  const imagem = candidato?.content?.parts?.find(p => p.inlineData?.data)
  if (imagem?.inlineData) return Buffer.from(imagem.inlineData.data, 'base64')
  throw new ErroRecusa(`Resposta sem imagem (motivo: ${candidato?.finishReason ?? 'desconhecido'})`)
}

/** Proporções de saída aceitas pelos modelos de imagem Gemini. */
const PROPORCOES = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']

/** A proporção aceita mais próxima de largura × altura (comparada em escala logarítmica). */
export function proporcaoMaisProxima(largura: number, altura: number): string {
  const alvo = Math.log(largura / altura)
  const distancia = (p: string) => {
    const [l, a] = p.split(':').map(Number)
    return Math.abs(Math.log(l / a) - alvo)
  }
  return PROPORCOES.reduce((melhor, p) => (distancia(p) < distancia(melhor) ? p : melhor))
}

/** Pede a saída na proporção da foto, para manter o enquadramento; sem dimensões legíveis, deixa o modelo decidir. */
async function configuracaoDeImagem(foto: Buffer): Promise<{ imageConfig?: { aspectRatio: string } }> {
  try {
    const { width, height } = await sharp(foto).metadata()
    return width && height ? { imageConfig: { aspectRatio: proporcaoMaisProxima(width, height) } } : {}
  } catch {
    return {}
  }
}

const jpeg = (b: Buffer): Parte => ({ inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } })

/**
 * Provedor Google Cloud Vertex AI (modelos de imagem Gemini). As credenciais vêm do login OAuth
 * (Application Default Credentials); nada de chave no código ou no ambiente.
 */
export function criarProvedorVertex(
  o: { projeto: string; local: string; modelo: string; tempoLimiteMs?: number },
  gerar?: GerarConteudo,
): Provedor {
  let chamar = gerar
  const cliente = (): GerarConteudo => {
    if (!chamar) {
      const ai = new GoogleGenAI({ vertexai: true, project: o.projeto, location: o.local })
      chamar = pedido => ai.models.generateContent(pedido)
    }
    return chamar
  }

  return {
    nome: 'vertex',
    modelo: o.modelo,
    async pintar(foto: Buffer, estilo: Estilo, sinal?: AbortSignal) {
      const referencia = estilo.caminhoReferencia ? await readFile(estilo.caminhoReferencia) : undefined
      const pedido: PedidoVertex = {
        model: o.modelo,
        contents: [
          {
            role: 'user',
            parts: [
              { text: montarPrompt(estilo, !!referencia) },
              { text: ROTULO_FOTO },
              jpeg(foto),
              ...(referencia ? [{ text: ROTULO_REFERENCIA }, jpeg(referencia)] : []),
            ],
          },
        ],
        config: {
          responseModalities: ['IMAGE'],
          ...(await configuracaoDeImagem(foto)),
          abortSignal: sinal,
          // Sem tempo limite próprio, o SDK espera até 10 minutos por uma chamada travada.
          httpOptions: { timeout: o.tempoLimiteMs ?? 90_000 },
        },
      }
      let resposta: unknown
      try {
        resposta = await cliente()(pedido)
      } catch (e) {
        if (e instanceof ApiError) throw classificarStatus(e.status, e.message)
        // Login ausente ou expirado não é falha de rede: repetir não adianta, e o log precisa pedir novo login.
        const login = erroDeLogin((e as Error).message)
        if (login) throw login
        throw new ErroTemporario(`Falha de rede no Vertex AI: ${(e as Error).message}`)
      }
      return interpretarVertex(resposta)
    },
  }
}
