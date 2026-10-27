export interface TetoDiario {
  /** Reserva uma vaga; false quando gravadas + em andamento já chegaram ao teto. */
  reservar(): boolean
  /** A pintura reservada foi gravada. */
  confirmar(): void
  /** A pintura reservada não aconteceu; devolve a vaga. */
  liberar(): void
  gravadasHoje(): number
}

/** Conta as pinturas do dia em memória, incluindo as em andamento, para pedidos simultâneos não furarem o teto. */
export function criarTetoDiario(o: { teto: number; contagemInicial: number; hoje: () => string }): TetoDiario {
  let dia = o.hoje()
  let gravadas = o.contagemInicial
  let emAndamento = 0
  const virarDia = () => {
    const d = o.hoje()
    if (d !== dia) {
      dia = d
      gravadas = 0
    }
  }
  return {
    reservar() {
      virarDia()
      if (gravadas + emAndamento >= o.teto) return false
      emAndamento++
      return true
    },
    confirmar() {
      virarDia()
      emAndamento = Math.max(0, emAndamento - 1)
      gravadas++
    },
    liberar() {
      emAndamento = Math.max(0, emAndamento - 1)
    },
    gravadasHoje() {
      virarDia()
      return gravadas
    },
  }
}
