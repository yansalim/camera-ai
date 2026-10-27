import { ErroPintura } from './api'
import { calcularDimensoes, canvasParaJpeg } from './foto'

// A foto vem sempre da câmera, nunca da galeria (Decisão 16): o site abre a câmera ele mesmo.

const MENSAGENS = {
  CAMERA_NEGADA: 'Para criar sua obra, permita o uso da câmera e toque em “Tirar foto” de novo.',
  CAMERA_AUSENTE: 'Não encontrei uma câmera neste aparelho.',
  CAMERA_OCUPADA: 'A câmera está sendo usada por outro aplicativo. Feche-o e toque em “Tirar foto” de novo.',
  CAMERA_INDISPONIVEL: 'Este navegador não abre a câmera. Abra o link no Chrome ou no Safari.',
} as const

const erro = (codigo: keyof typeof MENSAGENS) => new ErroPintura(codigo, MENSAGENS[codigo])

function traduzir(e: unknown): ErroPintura {
  switch ((e as DOMException)?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return erro('CAMERA_NEGADA')
    case 'NotFoundError':
    case 'OverconstrainedError':
      return erro('CAMERA_AUSENTE')
    case 'NotReadableError':
    case 'AbortError':
      return erro('CAMERA_OCUPADA')
    default:
      return erro('CAMERA_INDISPONIVEL')
  }
}

/** Pede a câmera frontal (só vídeo) e liga a imagem ao vivo no <video>. */
export async function abrirCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const midia = navigator.mediaDevices
  // Sem mediaDevices: navegador embutido que não libera câmera, ou página fora de HTTPS.
  if (typeof midia?.getUserMedia !== 'function') throw erro('CAMERA_INDISPONIVEL')
  let stream: MediaStream
  try {
    stream = await midia.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1600 }, height: { ideal: 1600 } }, audio: false })
  } catch (e) {
    throw traduzir(e)
  }
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  try {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise(pronto => video.addEventListener('loadedmetadata', pronto, { once: true }))
    }
    await video.play()
  } catch (e) {
    fecharCamera(stream)
    throw traduzir(e)
  }
  return stream
}

/** Fotografa o quadro mostrado, espelhado como a pessoa se vê na tela; lado maior ≤ 1600 px, JPEG 0,85. */
export function fotografar(video: HTMLVideoElement): Promise<Blob> {
  const { largura, altura } = calcularDimensoes(video.videoWidth, video.videoHeight)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')!
  ctx.translate(largura, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, 0, 0, largura, altura)
  return canvasParaJpeg(canvas, 0.85)
}

/** Desliga a câmera (a luz do aparelho apaga). */
export function fecharCamera(stream: MediaStream): void {
  stream.getTracks().forEach(trilha => trilha.stop())
}
