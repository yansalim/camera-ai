import fs from 'node:fs'
import path from 'node:path'

export interface Estilo {
  id: string
  nome: string
  legenda: string
  prompt: string
  frases: string[]
  ordem: number
  ativo: boolean
  caminhoMiniatura: string
  caminhoReferencia?: string
}

export interface Catalogo {
  ativos(): Estilo[]
  /** Só encontra estilos ativos. */
  buscar(id: string): Estilo | undefined
}

/** Lê `estilo.json` e valida os campos; lança Error com o motivo quando algo está errado. */
function lerEstilo(pasta: string, id: string): Estilo {
  const caminhoMiniatura = path.join(pasta, 'miniatura.jpg')
  if (!fs.existsSync(caminhoMiniatura)) throw new Error('falta miniatura.jpg')

  let dados: Record<string, unknown>
  try {
    dados = JSON.parse(fs.readFileSync(path.join(pasta, 'estilo.json'), 'utf8'))
  } catch (e) {
    throw new Error(`estilo.json ilegível (${(e as Error).message})`)
  }

  for (const campo of ['nome', 'legenda', 'prompt'] as const) {
    if (typeof dados[campo] !== 'string' || dados[campo] === '') throw new Error(`campo "${campo}" ausente ou inválido`)
  }
  if (typeof dados.ordem !== 'number') throw new Error('campo "ordem" ausente ou inválido')
  if (typeof dados.ativo !== 'boolean') throw new Error('campo "ativo" ausente ou inválido')
  const frases = dados.frases
  if (!Array.isArray(frases) || frases.length === 0 || !frases.every(f => typeof f === 'string' && f !== '')) {
    throw new Error('campo "frases" precisa ser uma lista de textos com ao menos um item')
  }

  const caminhoReferencia = path.join(pasta, 'referencia.jpg')
  return {
    id,
    nome: dados.nome as string,
    legenda: dados.legenda as string,
    prompt: dados.prompt as string,
    frases,
    ordem: dados.ordem,
    ativo: dados.ativo,
    caminhoMiniatura,
    ...(fs.existsSync(caminhoReferencia) ? { caminhoReferencia } : {}),
  }
}

/** Carrega o catálogo de estilos (uma pasta por estilo). Pastas inválidas são ignoradas com aviso. */
export function carregarCatalogo(dir: string, avisar: (msg: string) => void): Catalogo {
  const estilos: Estilo[] = []
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue
    try {
      estilos.push(lerEstilo(path.join(dir, entrada.name), entrada.name))
    } catch (e) {
      avisar(`Estilo "${entrada.name}" ignorado: ${(e as Error).message}`)
    }
  }
  const ativos = estilos.filter(e => e.ativo).sort((a, b) => a.ordem - b.ordem)
  return {
    ativos: () => [...ativos],
    buscar: id => ativos.find(e => e.id === id),
  }
}
