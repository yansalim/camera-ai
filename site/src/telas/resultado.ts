import { compartilhar, mostrarParaSalvar, salvar } from '../compartilhar'
import { h } from '../dom'
import { estado, irPara } from '../navegacao'

type Versao = 'moldura' | 'pintura'

/**
 * Resultado: a obra diante do disco, a escolha "Com moldura / Só a pintura" e a etiqueta de museu
 * com o código da obra no lugar do número de inventário.
 */
export function montarResultado(raiz: HTMLElement, opcoes: { versao?: Versao; dicaIos?: boolean } = {}): void {
  const { estilo, resultado, comMoldura } = estado
  if (!estilo || !resultado || !comMoldura) {
    irPara('quadros')
    return
  }
  const urls: Record<Versao, string> = { moldura: URL.createObjectURL(comMoldura), pintura: URL.createObjectURL(resultado.imagem) }
  const blobs: Record<Versao, Blob> = { moldura: comMoldura, pintura: resultado.imagem }
  let versao: Versao = opcoes.versao ?? 'moldura'

  const imagem = h('img', { src: urls[versao], alt: `Sua obra no estilo ${estilo.nome}`, 'data-testid': 'imagem-resultado' })
  const opcao = (v: Versao, texto: string, testid: string) => {
    const b = h('button', { type: 'button', class: 'opcao', 'data-testid': testid, 'aria-pressed': String(v === versao) }, texto)
    b.addEventListener('click', () => escolher(v))
    return b
  }
  const opcoesVersao = [opcao('moldura', 'Com moldura', 'opcao-com-moldura'), opcao('pintura', 'Só a pintura', 'opcao-so-pintura')]
  const escolher = (v: Versao) => {
    versao = v
    imagem.src = urls[v]
    opcoesVersao.forEach((b, i) => b.setAttribute('aria-pressed', String((i === 0 ? 'moldura' : 'pintura') === v)))
  }

  const nomeArquivo = () => `${versao === 'moldura' ? 'pintura-moldura' : 'pintura'}${resultado.codigo ? `-${resultado.codigo}` : ''}.jpg`
  const botaoCompartilhar = h('button', { type: 'button', class: 'botao', 'data-testid': 'botao-compartilhar' }, 'Compartilhar')
  const botaoSalvar = h('button', { type: 'button', class: 'botao botao-tinta', 'data-testid': 'botao-salvar' }, 'Salvar')
  const pintarDeNovo = h('button', { type: 'button', class: 'link', 'data-testid': 'botao-pintar-de-novo' }, 'Pintar de novo')

  raiz.append(
    h(
      'section',
      { class: 'tela tela-resultado' },
      h('h1', { class: 'titulo', tabindex: '-1' }, 'Sua obra está pronta'),
      h('div', { class: 'resultado-disco' }, h('div', { class: 'disco', 'aria-hidden': 'true' }), imagem),
      h(
        'div',
        { class: 'resultado-texto' },
        h('div', { class: 'opcoes', role: 'group', 'aria-label': 'Versão da obra' }, ...opcoesVersao),
        h(
          'div',
          { class: 'etiqueta' },
          h('p', { class: 'etiqueta-titulo' }, 'Seu retrato'),
          h('p', {}, `Estilo de ${estilo.nome}, ${estilo.legenda}`),
          h('p', {}, `Pintado por IA no estande da escola, ${new Date().getFullYear()}`),
          resultado.codigo ? h('p', { class: 'nums', 'data-testid': 'codigo-obra' }, `Código da obra: ${resultado.codigo}`) : null,
        ),
        h('div', { class: 'resultado-acoes' }, botaoCompartilhar, botaoSalvar, pintarDeNovo),
      ),
    ),
  )

  botaoCompartilhar.addEventListener('click', async () => {
    botaoCompartilhar.disabled = true
    try {
      // Sem menu de compartilhar com arquivo, cai para Salvar.
      if ((await compartilhar(blobs[versao], nomeArquivo())) === 'indisponivel') salvar(blobs[versao], nomeArquivo())
    } finally {
      botaoCompartilhar.disabled = false
    }
  })
  botaoSalvar.addEventListener('click', () => salvar(blobs[versao], nomeArquivo()))
  pintarDeNovo.addEventListener('click', () => {
    estado.foto = undefined
    estado.resultado = undefined
    estado.comMoldura = undefined
    irPara('quadros')
  })

  if (opcoes.dicaIos) mostrarParaSalvar(urls[versao])
}
