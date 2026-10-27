import { obterIdAparelho, registrarAceite } from '../aceite'
import { buscarSaude } from '../api'
import { CONFIG } from '../config'
import { h } from '../dom'
import { irPara } from '../navegacao'

const RESUMO =
  'Tire uma foto e veja ela virar uma obra de arte. Ao continuar, você declara ter 18 anos ou mais e autoriza a escola a guardar sua foto e a pintura e usá-las em eventos futuros.'

/** Início: o aceite. Clicar em "Quero criar minha foto" registra o aceite antes de qualquer câmera. */
export function montarInicio(raiz: HTMLElement, opcoes: { eventoAtivo?: boolean } = {}): void {
  const botao = h('button', { type: 'button', class: 'botao', 'data-testid': 'botao-criar' }, 'Quero criar minha foto')
  const aviso = h('p', { class: 'aviso', role: 'status', 'data-testid': 'aviso-evento-inativo', hidden: true }, 'Esta experiência está disponível no estande.')

  raiz.append(
    h(
      'section',
      { class: 'tela tela-inicio' },
      h('header', { class: 'barra' }, h('span', { class: 'marca' }, CONFIG.escola), h('a', { class: 'link', href: '/termos.html' }, 'Termos')),
      h('h1', { class: 'display', tabindex: '-1' }, 'Vire uma', h('br'), 'obra de arte'),
      h(
        'div',
        { class: 'inicio-aceite' },
        h('p', {}, RESUMO),
        h('a', { class: 'link', href: '/termos.html', 'data-testid': 'link-termos' }, 'Ler os termos de uso de imagem'),
        aviso,
        botao,
        h('p', { class: 'pequeno' }, 'Obras em domínio público. ', h('a', { class: 'link', href: '/termos.html#creditos' }, 'Créditos nos termos'), '.'),
      ),
    ),
  )

  botao.addEventListener('click', () => {
    registrarAceite()
    obterIdAparelho()
    irPara('quadros')
  })

  const aplicar = (eventoAtivo: boolean) => {
    aviso.hidden = eventoAtivo
    botao.hidden = !eventoAtivo
  }
  if (opcoes.eventoAtivo !== undefined) aplicar(opcoes.eventoAtivo)
  // Sem resposta do servidor, o botão continua; o erro aparece na hora de pintar.
  else buscarSaude().then(s => aplicar(s.eventoAtivo), () => {})
}
