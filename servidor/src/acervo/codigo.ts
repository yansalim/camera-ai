/** Sem 0, O, 1, I e L, que se confundem quando a pessoa lê ou dita o código. */
export const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** Código da obra no formato XXX-XXX. */
export function gerarCodigo(aleatorio: () => number = Math.random): string {
  const letra = () => ALFABETO[Math.floor(aleatorio() * ALFABETO.length)]
  const bloco = () => letra() + letra() + letra()
  return `${bloco()}-${bloco()}`
}

const formatoData = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Data AAAA-MM-DD no fuso de São Paulo, que nomeia as pastas do acervo. */
export function dataLocal(d: Date): string {
  return formatoData.format(d)
}
