import type { ErroPintura, EstiloPublico, ResultadoPintura } from './api'

export type Tela = 'inicio' | 'quadros' | 'foto' | 'revelacao' | 'resultado' | 'erro'

/** O que o visitante já escolheu e recebeu nesta visita. */
export interface Estado {
  estilo?: EstiloPublico
  foto?: Blob
  resultado?: ResultadoPintura
  comMoldura?: Blob
}

export interface DadosDaTela {
  erro?: ErroPintura
}

export const estado: Estado = {}

type Montar = (raiz: HTMLElement, dados: DadosDaTela) => void | Promise<void>
const telas = new Map<Tela, Montar>()

export function registrarTela(tela: Tela, montar: Montar): void {
  telas.set(tela, montar)
}

/**
 * Troca a tela inteira. Cada tela é um capítulo com a cor de parede dela (data-tela no body);
 * o foco vai para o título, para quem navega por teclado ou leitor de tela.
 */
export function irPara(tela: Tela, dados: DadosDaTela = {}): void {
  const raiz = document.querySelector<HTMLElement>('#app')
  const montar = telas.get(tela)
  if (!raiz || !montar) throw new Error(`Tela não registrada: ${tela}`)
  document.body.dataset.tela = tela
  raiz.replaceChildren()
  window.scrollTo(0, 0)
  void Promise.resolve(montar(raiz, dados)).then(() => raiz.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }))
}
