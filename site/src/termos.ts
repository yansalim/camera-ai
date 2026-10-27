import './estilos.css'
import { CONFIG } from './config'
import { h } from './dom'

const escola = CONFIG.escola
const email = CONFIG.emailContato

/** Itens da spec 6.2, por extenso. Rascunho: a escola revisa antes do evento. */
const secoes: Array<[string, Array<string | Node>]> = [
  ['Quem guarda as imagens', [`${escola} guarda as fotos e as obras criadas nesta experiência.`]],
  [
    'O que é guardado',
    ['A foto que você tirar e a obra gerada a partir dela, junto com o estilo escolhido, a data e o código da obra. Não guardamos seu nome, seu telefone nem o endereço de internet do seu aparelho.'],
  ],
  ['Para que as imagens são usadas', [`Para exibição em eventos da escola e para divulgação das atividades de ${escola}.`]],
  [
    'Quem processa a foto',
    ['Para criar a obra, a foto é enviada a um provedor externo de inteligência artificial (Google Cloud), que a processa e devolve a imagem pintada.'],
  ],
  ['Por quanto tempo', ['As imagens ficam guardadas por até 5 anos, ou por menos tempo, se a escola decidir apagar antes.']],
  ['Maioridade', ['Ao tocar em “Quero criar minha foto”, você declara ter 18 anos ou mais.']],
  [
    'Pedido de exclusão',
    [
      'Para pedir a exclusão da sua foto e da obra, escreva para ',
      h('a', { class: 'link', href: `mailto:${email}` }, email),
      ' informando o código da obra que aparece na tela do resultado (por exemplo, K7M-3PX).',
    ],
  ],
]

const raiz = document.querySelector<HTMLElement>('#termos')!
document.body.dataset.tela = 'termos'
raiz.append(
  h(
    'article',
    { class: 'termos' },
    h('h1', { class: 'titulo' }, 'Termos de uso de imagem'),
    h('p', { class: 'termos-intro' }, `Versão ${CONFIG.termosVersao}. Leia antes de criar a sua obra; tocar em “Quero criar minha foto” é o aceite destes termos.`),
    ...secoes.map(([titulo, corpo]) => h('section', { class: 'termos-item' }, h('h2', {}, titulo), h('p', {}, ...corpo))),
    h(
      'section',
      { class: 'termos-item', id: 'creditos' },
      h('h2', {}, 'Créditos das imagens'),
      h(
        'div',
        { class: 'termos-creditos' },
        h('p', {}, 'Mona Lisa, Leonardo da Vinci, 1503–1519. Museu do Louvre, Paris. Imagem: Wikimedia Commons, domínio público.'),
        h('p', {}, 'Fonte tipográfica: Schibsted Grotesk, licença SIL Open Font License 1.1.'),
      ),
    ),
  ),
  h(
    'footer',
    { class: 'rodape' },
    h('p', { class: 'rodape-marca' }, 'Vire uma obra de arte'),
    h('a', { class: 'rodape-convite', href: '/' }, 'Criar minha foto'),
    h('p', { class: 'rodape-versao' }, `${escola}. Termos na versão ${CONFIG.termosVersao}.`),
  ),
)
