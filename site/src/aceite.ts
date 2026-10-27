import { gravar, ler } from './armazenamento'
import { CONFIG } from './config'

export interface Aceite {
  termosVersao: string
  aceiteEm: string
}

/** Clicar em "Quero criar minha foto" é o aceite: guarda o momento e a versão dos termos. */
export function registrarAceite(agora: Date = new Date()): Aceite {
  const aceite: Aceite = { termosVersao: CONFIG.termosVersao, aceiteEm: agora.toISOString() }
  gravar('aceite', JSON.stringify(aceite))
  return aceite
}

/** Aceite guardado, ou null se não houver ou se for de outra versão dos termos. */
export function lerAceite(): Aceite | null {
  const bruto = ler('aceite')
  if (!bruto) return null
  try {
    const a = JSON.parse(bruto) as Partial<Aceite>
    if (a.termosVersao !== CONFIG.termosVersao || typeof a.aceiteEm !== 'string') return null
    return { termosVersao: a.termosVersao, aceiteEm: a.aceiteEm }
  } catch {
    return null
  }
}

/** Identificador aleatório do aparelho, só para o limite de uso por aparelho. */
export function obterIdAparelho(): string {
  const existente = ler('aparelho')
  if (existente) return existente
  const novo = crypto.randomUUID()
  gravar('aparelho', novo)
  return novo
}
