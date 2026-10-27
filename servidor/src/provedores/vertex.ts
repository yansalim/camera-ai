import { readFile } from 'node:fs/promises'
import { ApiError, GoogleGenAI } from '@google/genai'
import type { Estilo } from '../estilos/catalogo.js'
import { classificarStatus } from './http.js'
import { montarPrompt } from './prompt.js'
import { ErroRecusa, ErroTemporario, type Provedor } from './tipos.js'

interface Parte {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

export interface PedidoVertex {
  model: string
  contents: Array<{ role: 'user'; parts: Parte[] }>
  config: { responseModalities: string[] }
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

const jpeg = (b: Buffer): Parte => ({ inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } })

/**
 * Provedor Google Cloud Vertex AI (modelos de imagem Gemini). As credenciais vêm do login OAuth
 * (Application Default Credentials); nada de chave no código ou no ambiente.
 */
export function criarProvedorVertex(o: { projeto: string; local: string; modelo: string }, gerar?: GerarConteudo): Provedor {
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
    async pintar(foto: Buffer, estilo: Estilo) {
      const referencia = estilo.caminhoReferencia ? await readFile(estilo.caminhoReferencia) : undefined
      const pedido: PedidoVertex = {
        model: o.modelo,
        contents: [{ role: 'user', parts: [{ text: montarPrompt(estilo, !!referencia) }, jpeg(foto), ...(referencia ? [jpeg(referencia)] : [])] }],
        config: { responseModalities: ['IMAGE'] },
      }
      let resposta: unknown
      try {
        resposta = await cliente()(pedido)
      } catch (e) {
        if (e instanceof ApiError) throw classificarStatus(e.status, e.message)
        throw new ErroTemporario(`Falha de rede no Vertex AI: ${(e as Error).message}`)
      }
      return interpretarVertex(resposta)
    },
  }
}
