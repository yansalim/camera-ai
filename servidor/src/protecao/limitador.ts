export interface Limitador {
  /** true = permitido (e contado); false = passou do limite na janela. */
  tentar(chave: string): boolean
}

/** Janela deslizante: guarda os instantes permitidos de cada chave e descarta os que saíram da janela. */
export function criarLimitador(o: { max: number; janelaMs: number; agora?: () => number }): Limitador {
  const agora = o.agora ?? Date.now
  const instantes = new Map<string, number[]>()
  return {
    tentar(chave) {
      const t = agora()
      const recentes = (instantes.get(chave) ?? []).filter(i => t - i <= o.janelaMs)
      const permitido = recentes.length < o.max
      if (permitido) recentes.push(t)
      if (recentes.length > 0) instantes.set(chave, recentes)
      else instantes.delete(chave)
      return permitido
    },
  }
}
