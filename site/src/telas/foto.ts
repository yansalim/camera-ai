import { ErroPintura } from '../api'
import { abrirCamera, fecharCamera, fotografar } from '../camera'
import { h } from '../dom'
import { aoSairDaTela, estado, irPara } from '../navegacao'

/**
 * Foto: o site abre a câmera frontal e mostra a imagem ao vivo; a foto vem sempre da câmera,
 * nunca da galeria (Decisão 16). Sem câmera, um aviso diz o que fazer.
 */
export function montarFoto(raiz: HTMLElement): void {
  const estilo = estado.estilo
  if (!estilo) {
    irPara('quadros')
    return
  }
  const obra = h('img', { src: estilo.miniaturaUrl, alt: `${estilo.nome}, ${estilo.legenda}`, width: '725', height: '1080' })
  const video = h('video', { class: 'camera', 'data-testid': 'camera-ao-vivo', muted: true, playsinline: true, hidden: true, 'aria-label': 'Imagem da câmera' })
  const aviso = h('p', { class: 'aviso-camera', role: 'alert', 'data-testid': 'aviso-camera', hidden: true })
  const tirar = h('button', { type: 'button', class: 'botao', 'data-testid': 'botao-tirar-foto' }, 'Tirar foto')
  const fotografarBotao = h('button', { type: 'button', class: 'botao', 'data-testid': 'botao-fotografar', hidden: true }, 'Fotografar')
  const trocar = h('button', { type: 'button', class: 'link' }, 'Trocar de obra')

  raiz.append(
    h(
      'section',
      { class: 'tela tela-foto' },
      h(
        'div',
        { class: 'foto-texto' },
        h('h1', { class: 'titulo', tabindex: '-1' }, 'Hora do retrato'),
        h('p', {}, 'Rosto bem iluminado e de frente para a câmera. O resultado sai em poucos segundos.'),
      ),
      h('figure', { class: 'foto-obra' }, obra, video, h('figcaption', {}, h('span', { class: 'ladrilho-nome' }, estilo.nome), h('span', {}, estilo.legenda))),
      h('div', { class: 'foto-acoes' }, aviso, trocar, tirar, fotografarBotao),
    ),
  )

  let stream: MediaStream | undefined
  const desligar = () => {
    if (stream) fecharCamera(stream)
    stream = undefined
  }
  aoSairDaTela(desligar)

  trocar.addEventListener('click', () => irPara('quadros'))

  tirar.addEventListener('click', async () => {
    tirar.disabled = true
    aviso.hidden = true
    obra.hidden = true
    video.hidden = false
    try {
      stream = await abrirCamera(video)
      tirar.hidden = true
      fotografarBotao.hidden = false
      fotografarBotao.focus()
    } catch (e) {
      video.hidden = true
      obra.hidden = false
      aviso.textContent = e instanceof ErroPintura ? e.message : 'Este navegador não abre a câmera. Abra o link no Chrome ou no Safari.'
      aviso.hidden = false
    } finally {
      tirar.disabled = false
    }
  })

  fotografarBotao.addEventListener('click', async () => {
    fotografarBotao.disabled = true
    try {
      estado.foto = await fotografar(video)
      estado.resultado = undefined
      estado.comMoldura = undefined
      desligar()
      irPara('revelacao')
    } catch {
      fotografarBotao.disabled = false
      irPara('erro', { erro: new ErroPintura('FOTO_INVALIDA', 'Não consegui abrir essa foto. Tente tirar outra.') })
    }
  })
}
