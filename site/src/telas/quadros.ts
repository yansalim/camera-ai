import { buscarEstilos, ErroPintura, type EstiloPublico } from '../api'
import { h } from '../dom'
import { estado, irPara } from '../navegacao'

const comoErro = (e: unknown) => (e instanceof ErroPintura ? e : new ErroPintura('IA_INDISPONIVEL', 'A pintora está com dificuldades. Tente de novo.'))

function ladrilho(estilo: EstiloPublico): HTMLLIElement {
  const botao = h(
    'button',
    { type: 'button', class: 'ladrilho', 'data-testid': 'cartao-estilo', 'data-estilo-id': estilo.id },
    h('img', { src: estilo.miniaturaUrl, alt: '', width: '725', height: '1080', decoding: 'async' }),
    h('span', { class: 'ladrilho-legenda' }, h('span', { class: 'ladrilho-nome' }, estilo.nome), h('span', {}, estilo.legenda)),
  )
  botao.addEventListener('click', () => {
    estado.estilo = estilo
    irPara('foto')
  })
  return h('li', {}, botao)
}

/** Escolha: a parede de quadrados, uma obra por quadrado, com nome e legenda do estilo. */
export async function montarQuadros(raiz: HTMLElement): Promise<void> {
  const parede = h('ul', { class: 'parede', 'aria-busy': 'true', 'aria-label': 'Estilos' })
  raiz.append(
    h(
      'section',
      { class: 'tela tela-quadros' },
      h('div', { class: 'quadros-topo' }, h('h1', { class: 'titulo', tabindex: '-1' }, 'Escolha o estilo da sua obra'), h('p', {}, 'Toque numa obra. A sua foto vai ser pintada do jeito dela.')),
      parede,
    ),
  )
  try {
    const estilos = await buscarEstilos()
    parede.dataset.quantidade = String(estilos.length)
    parede.append(...estilos.map(ladrilho))
    parede.removeAttribute('aria-busy')
  } catch (e) {
    irPara('erro', { erro: comoErro(e) })
  }
}
