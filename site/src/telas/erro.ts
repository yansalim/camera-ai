import { ErroPintura } from '../api'
import { h } from '../dom'
import { type DadosDaTela, estado, irPara, type Tela } from '../navegacao'

const generico = () => new ErroPintura('IA_INDISPONIVEL', 'A pintora está com dificuldades. Tente de novo.')

/** Para onde cada erro leva: outra foto, outra obra, o início ou tentar de novo com a mesma foto. */
function acao(codigo: string): { texto: string; testid?: string; destino: () => Tela } {
  switch (codigo) {
    case 'FOTO_INVALIDA':
    case 'RECUSADA':
      return { texto: 'Tirar outra foto', testid: 'botao-outra-foto', destino: () => (estado.estilo ? 'foto' : 'quadros') }
    case 'ESTILO_INVALIDO':
      return { texto: 'Escolher outra obra', destino: () => 'quadros' }
    case 'ACEITE_AUSENTE':
      return { texto: 'Voltar ao início', destino: () => 'inicio' }
    default:
      return {
        texto: 'Tentar de novo',
        testid: 'botao-tentar-de-novo',
        destino: () => (estado.estilo && estado.foto ? 'revelacao' : estado.estilo ? 'foto' : 'quadros'),
      }
  }
}

/** Erro: a mensagem exata do que houve e o próximo passo; a foto continua guardada para tentar de novo. */
export function montarErro(raiz: HTMLElement, dados: DadosDaTela): void {
  const erro = dados.erro ?? generico()

  if (erro.codigo === 'EVENTO_INATIVO') {
    raiz.append(
      h(
        'section',
        { class: 'tela tela-pausa', 'data-testid': 'tela-erro' },
        h('h1', { class: 'display', tabindex: '-1' }, 'Experiência', h('br'), 'pausada'),
        // A obra escolhida fica à vista, esperando o evento voltar.
        estado.estilo ? h('img', { class: 'pausa-obra', src: estado.estilo.miniaturaUrl, alt: `${estado.estilo.nome}, ${estado.estilo.legenda}` }) : null,
        h('p', { class: 'erro-mensagem', 'data-testid': 'aviso-evento-inativo' }, erro.message),
      ),
    )
    return
  }

  const { texto, testid, destino } = acao(erro.codigo)
  const botao = h('button', { type: 'button', class: 'botao', ...(testid ? { 'data-testid': testid } : {}) }, texto)
  const foto = estado.foto ? h('img', { class: 'erro-foto', src: URL.createObjectURL(estado.foto), alt: 'A sua foto' }) : null

  raiz.append(
    h(
      'section',
      { class: 'tela tela-erro', 'data-testid': 'tela-erro' },
      h('h1', { class: 'titulo', tabindex: '-1' }, 'A pintura parou no meio'),
      h('p', { class: 'erro-mensagem', 'data-testid': 'mensagem-erro' }, erro.message),
      foto,
      h('div', { class: 'erro-acoes' }, botao),
    ),
  )
  botao.addEventListener(
    'click',
    () => {
      botao.disabled = true
      irPara(destino())
    },
    { once: true },
  )
}
