// localStorage com reserva em memória: aba anônima e navegadores embutidos podem bloquear o acesso.
const memoria = new Map<string, string>()

export function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave) ?? memoria.get(chave) ?? null
  } catch {
    return memoria.get(chave) ?? null
  }
}

export function gravar(chave: string, valor: string): void {
  try {
    localStorage.setItem(chave, valor)
  } catch {
    memoria.set(chave, valor)
  }
}
