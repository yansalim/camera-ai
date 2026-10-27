type Filho = Node | string | null | undefined | false
type Atributos = Record<string, string | boolean | undefined>

/** Cria um elemento com atributos e filhos; texto entra sempre como texto, nunca como HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, atributos: Atributos = {}, ...filhos: Filho[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === false) continue
    el.setAttribute(nome, valor === true ? '' : valor)
  }
  for (const filho of filhos) if (filho !== null && filho !== undefined && filho !== false) el.append(filho)
  return el
}
