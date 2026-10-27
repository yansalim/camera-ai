import { afterEach, describe, expect, it, vi } from 'vitest'
import { abrirCamera, fecharCamera, fotografar } from '../src/camera'
import { pixel } from './ajudantes'

/** "Câmera" de teste: metade esquerda vermelha, metade direita azul. */
function cameraFalsa(largura = 640, altura = 480): MediaStream {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')!
  const desenhar = () => {
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, largura / 2, altura)
    ctx.fillStyle = '#0000ff'
    ctx.fillRect(largura / 2, 0, largura / 2, altura)
  }
  desenhar()
  const intervalo = setInterval(desenhar, 30)
  const stream = canvas.captureStream(30)
  stream.getTracks()[0].addEventListener('ended', () => clearInterval(intervalo))
  return stream
}

const abertas: MediaStream[] = []
afterEach(() => {
  abertas.splice(0).forEach(fecharCamera)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function abrirComCamera(stream: MediaStream) {
  abertas.push(stream)
  const pedido = vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(stream)
  const video = document.createElement('video')
  document.body.append(video)
  await abrirCamera(video)
  return { video, pedido }
}

describe('abrirCamera', () => {
  it('pede só a câmera frontal, sem áudio, e liga o vídeo', async () => {
    const stream = cameraFalsa()
    const { video, pedido } = await abrirComCamera(stream)
    expect(pedido).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: 'user' }) }))
    expect(video.srcObject).toBe(stream)
    expect(video.videoWidth).toBe(640)
  })

  it('permissão negada vira CAMERA_NEGADA', async () => {
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new DOMException('negado', 'NotAllowedError'))
    await expect(abrirCamera(document.createElement('video'))).rejects.toMatchObject({
      codigo: 'CAMERA_NEGADA',
      message: 'Para criar sua obra, permita o uso da câmera e toque em “Tirar foto” de novo.',
    })
  })

  it('aparelho sem câmera vira CAMERA_AUSENTE', async () => {
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new DOMException('nada', 'NotFoundError'))
    await expect(abrirCamera(document.createElement('video'))).rejects.toMatchObject({ codigo: 'CAMERA_AUSENTE' })
  })

  it('câmera presa em outro aplicativo vira CAMERA_OCUPADA', async () => {
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new DOMException('ocupada', 'NotReadableError'))
    await expect(abrirCamera(document.createElement('video'))).rejects.toMatchObject({ codigo: 'CAMERA_OCUPADA' })
  })

  it('navegador sem acesso à câmera pede para abrir no Chrome ou no Safari', async () => {
    vi.stubGlobal('navigator', {})
    await expect(abrirCamera(document.createElement('video'))).rejects.toMatchObject({
      codigo: 'CAMERA_INDISPONIVEL',
      message: 'Este navegador não abre a câmera. Abra o link no Chrome ou no Safari.',
    })
  })
})

describe('fotografar', () => {
  it('devolve um JPEG do tamanho do vídeo, espelhado como a pessoa se vê na tela', async () => {
    const { video } = await abrirComCamera(cameraFalsa(640, 480))
    const foto = await fotografar(video)
    expect(foto.type).toBe('image/jpeg')
    const i = await createImageBitmap(foto)
    expect([i.width, i.height]).toEqual([640, 480])
    expect(pixel(i, 20, 240)).toBeCloseToCor([0, 0, 255], 40)
    expect(pixel(i, 620, 240)).toBeCloseToCor([255, 0, 0], 40)
  })

  it('limita o lado maior a 1600 px', async () => {
    const { video } = await abrirComCamera(cameraFalsa(2000, 1000))
    const i = await createImageBitmap(await fotografar(video))
    expect([i.width, i.height]).toEqual([1600, 800])
  })
})

describe('fecharCamera', () => {
  it('desliga todas as trilhas (a luz da câmera apaga)', () => {
    const stream = cameraFalsa()
    fecharCamera(stream)
    expect(stream.getTracks().every(t => t.readyState === 'ended')).toBe(true)
  })
})
