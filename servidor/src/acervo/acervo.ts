import fs from 'node:fs/promises'
import path from 'node:path'
import { dataLocal, gerarCodigo } from './codigo.js'

export interface RegistroObra {
  estiloId: string
  estiloNome: string
  provedor: string
  modelo: string
  termosVersao: string
  aceiteEm: string
}

export interface Acervo {
  /** Grava original + pintura + info.json e devolve o código da obra. */
  gravar(original: Buffer, pintura: Buffer, registro: RegistroObra): Promise<string>
  /** Obras gravadas hoje (fuso de São Paulo). */
  contarHoje(): Promise<number>
}

const existe = (caminho: string) => fs.access(caminho).then(() => true, () => false)

async function pastasDeDatas(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name)
  } catch {
    return []
  }
}

export function criarAcervo(opcoes: { dir: string; agora?: () => Date; aleatorio?: () => number }): Acervo {
  const { dir } = opcoes
  const agora = opcoes.agora ?? (() => new Date())

  /** Código que ainda não existe em nenhum dia do acervo. */
  async function codigoLivre(): Promise<string> {
    const datas = await pastasDeDatas(dir)
    for (;;) {
      const codigo = gerarCodigo(opcoes.aleatorio)
      const usado = await Promise.all(datas.map(d => existe(path.join(dir, d, codigo))))
      if (!usado.some(Boolean)) return codigo
    }
  }

  return {
    async gravar(original, pintura, registro) {
      const criadoEm = agora()
      const pastaDia = path.join(dir, dataLocal(criadoEm))
      await fs.mkdir(pastaDia, { recursive: true })
      const codigo = await codigoLivre()
      // Escreve numa pasta temporária e só depois renomeia: a obra nunca fica pela metade.
      const temporaria = path.join(pastaDia, `.tmp-${codigo}`)
      await fs.mkdir(temporaria)
      try {
        await fs.writeFile(path.join(temporaria, 'original.jpg'), original)
        await fs.writeFile(path.join(temporaria, 'pintura.jpg'), pintura)
        const info = { codigo, criadoEm: criadoEm.toISOString(), ...registro }
        await fs.writeFile(path.join(temporaria, 'info.json'), JSON.stringify(info, null, 2))
        await fs.rename(temporaria, path.join(pastaDia, codigo))
      } catch (e) {
        await fs.rm(temporaria, { recursive: true, force: true })
        throw e
      }
      return codigo
    },

    async contarHoje() {
      try {
        const entradas = await fs.readdir(path.join(dir, dataLocal(agora())), { withFileTypes: true })
        return entradas.filter(e => e.isDirectory() && !e.name.startsWith('.')).length
      } catch {
        return 0
      }
    },
  }
}
