import fs from 'node:fs'
import path from 'node:path'

/** Começa cada rodada com o acervo de teste vazio. */
export default function preparar() {
  fs.rmSync(path.resolve(import.meta.dirname, '.acervo'), { recursive: true, force: true })
}
