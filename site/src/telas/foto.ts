import { ErroPintura } from '../api'
import { h } from '../dom'
import { prepararFoto } from '../foto'
import { estado, irPara } from '../navegacao'

/** Foto: a câmera nativa do celular, com a obra escolhida à vista. */
export function montarFoto(raiz: HTMLElement): void {
  const estilo = estado.estilo
  if (!estilo) {
    irPara('quadros')
    return
  }
  const input = h('input', { type: 'file', accept: 'image/*', capture: 'user', hidden: true, 'data-testid': 'input-foto' })
  const botao = h('button', { type: 'button', class: 'botao', 'data-testid': 'botao-tirar-foto' }, 'Tirar foto')
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
      h(
        'figure',
        { class: 'foto-obra' },
        h('img', { src: estilo.miniaturaUrl, alt: `${estilo.nome}, ${estilo.legenda}`, width: '725', height: '1080' }),
        h('figcaption', {}, h('span', { class: 'ladrilho-nome' }, estilo.nome), h('span', {}, estilo.legenda)),
      ),
      h('div', { class: 'foto-acoes' }, trocar, botao, input),
    ),
  )

  trocar.addEventListener('click', () => irPara('quadros'))
  botao.addEventListener('click', () => input.click())
  input.addEventListener('change', async () => {
    const arquivo = input.files?.[0]
    if (!arquivo) return
    botao.disabled = true
    try {
      estado.foto = await prepararFoto(arquivo)
      estado.resultado = undefined
      estado.comMoldura = undefined
      irPara('revelacao')
    } catch (e) {
      irPara('erro', { erro: e instanceof ErroPintura ? e : new ErroPintura('FOTO_INVALIDA', 'Não consegui abrir essa foto. Tente tirar outra.') })
    } finally {
      botao.disabled = false
      input.value = ''
    }
  })
}
