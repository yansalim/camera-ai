import { h } from './dom'

/** iPhone e iPad; o iPadOS se apresenta como Mac, mas tem tela de toque. */
export function ehIOS(ua: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
}

/** Menu de compartilhar do celular, com o arquivo da obra. */
export async function compartilhar(imagem: Blob, nomeArquivo: string): Promise<'compartilhado' | 'cancelado' | 'indisponivel'> {
  const arquivo = new File([imagem], nomeArquivo, { type: 'image/jpeg' })
  if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [arquivo] })) return 'indisponivel'
  try {
    await navigator.share({ files: [arquivo] })
    return 'compartilhado'
  } catch (e) {
    return (e as DOMException)?.name === 'AbortError' ? 'cancelado' : 'indisponivel'
  }
}

/** Mostra a imagem em tela cheia para o "toque e segure" do iPhone (o download do Safari vai para Arquivos, não para Fotos). */
export function mostrarParaSalvar(url: string, aoFechar?: () => void): HTMLElement {
  const fechar = h('button', { type: 'button', class: 'botao' }, 'Fechar')
  const sobreposicao = h(
    'div',
    { class: 'salvar-ios', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Salvar a imagem' },
    h('img', { src: url, alt: 'Sua obra' }),
    h('p', {}, 'Toque e segure a imagem para salvar'),
    fechar,
  )
  fechar.addEventListener('click', () => {
    sobreposicao.remove()
    aoFechar?.()
  })
  document.body.append(sobreposicao)
  fechar.focus()
  return sobreposicao
}

/** Salva a obra: no iPhone abre a imagem para tocar e segurar; nos demais, baixa o arquivo. */
export function salvar(imagem: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(imagem)
  if (ehIOS(navigator.userAgent, navigator.maxTouchPoints)) {
    mostrarParaSalvar(url, () => URL.revokeObjectURL(url))
    return
  }
  const a = h('a', { href: url, download: nomeArquivo, hidden: true })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
