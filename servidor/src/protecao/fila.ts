export interface Fila {
  executar<T>(tarefa: () => Promise<T>): Promise<T>
  /** Esperando + executando. */
  tamanho(): number
}

/** Fila em ordem de chegada com no máximo `concorrencia` tarefas ao mesmo tempo. */
export function criarFila(concorrencia: number): Fila {
  let executando = 0
  const esperando: Array<() => void> = []

  const liberar = () => {
    executando--
    esperando.shift()?.()
  }

  return {
    async executar<T>(tarefa: () => Promise<T>): Promise<T> {
      if (executando >= concorrencia) {
        await new Promise<void>(vez => esperando.push(vez))
      }
      executando++
      try {
        return await tarefa()
      } finally {
        liberar()
      }
    },
    tamanho: () => executando + esperando.length,
  }
}
