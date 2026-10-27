// Teste comparativo entre modelos: cada modelo × estilo × foto, lado a lado num index.html.
// Uso (dentro de servidor/): npm run comparativo -- [modelo...]
// Lê comparativo/fotos/*.jpg; grava em comparativo/resultado/<modelo>/<estilo>/<foto>.jpg.
import fs from 'node:fs'
import path from 'node:path'
import { carregarCatalogo } from '../src/estilos/catalogo.js'
import { comNovaTentativa } from '../src/provedores/nova-tentativa.js'
import { ErroRecusa } from '../src/provedores/tipos.js'
import { criarProvedorVertex } from '../src/provedores/vertex.js'
import { DIR_COMPARATIVO, DIR_ESTILOS, gravarJpeg, lerFotos, lerGoogle, MODELOS_PADRAO } from './vertex-comum.js'

const SIMULTANEAS = 3

type Resultado = { modelo: string; estilo: string; foto: string; ms: number; status: 'ok' | 'recusa' | 'falha'; detalhe?: string }

const google = lerGoogle()
const modelos = process.argv.slice(2).length > 0 ? process.argv.slice(2) : MODELOS_PADRAO
const estilos = carregarCatalogo(DIR_ESTILOS, console.warn).ativos()
const fotos = await lerFotos()
const dirResultado = path.join(DIR_COMPARATIVO, 'resultado')

const tarefas = modelos.flatMap(modelo => estilos.flatMap(estilo => fotos.map(foto => ({ modelo, estilo, foto }))))
console.log(`${tarefas.length} chamadas: ${fotos.length} fotos × ${estilos.length} estilos × ${modelos.length} modelos`)

const resultados: Resultado[] = []
let proxima = 0
async function trabalhar() {
  while (proxima < tarefas.length) {
    const { modelo, estilo, foto } = tarefas[proxima++]
    const inicio = Date.now()
    const base = { modelo, estilo: estilo.id, foto: foto.nome }
    try {
      const imagem = await comNovaTentativa(criarProvedorVertex({ ...google, modelo })).pintar(foto.foto, estilo)
      await gravarJpeg(imagem, path.join(dirResultado, modelo, estilo.id, `${foto.nome}.jpg`))
      resultados.push({ ...base, ms: Date.now() - inicio, status: 'ok' })
    } catch (e) {
      const status = e instanceof ErroRecusa ? 'recusa' : 'falha'
      resultados.push({ ...base, ms: Date.now() - inicio, status, detalhe: (e as Error).message })
    }
    const r = resultados[resultados.length - 1]
    console.log(`[${resultados.length}/${tarefas.length}] ${r.status.padEnd(6)} ${modelo} ${estilo.id} ${foto.nome} (${(r.ms / 1000).toFixed(1)} s)`)
  }
}
await Promise.all(Array.from({ length: SIMULTANEAS }, trabalhar))

// Originais ao lado dos resultados.
for (const { nome, foto } of fotos) await gravarJpeg(foto, path.join(dirResultado, 'original', `${nome}.jpg`))

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const linhas = fotos.flatMap(({ nome }) =>
  estilos.map(estilo => {
    const celulas = modelos.map(modelo => {
      const r = resultados.find(x => x.modelo === modelo && x.estilo === estilo.id && x.foto === nome)
      return r?.status === 'ok'
        ? `<td><img src="${esc(`${modelo}/${estilo.id}/${nome}.jpg`)}"><small>${(r.ms / 1000).toFixed(1)} s</small></td>`
        : `<td class="erro">${esc(r?.status ?? '?')}<small>${esc(r?.detalhe ?? '')}</small></td>`
    })
    return `<tr><th>${esc(nome)}<br>${esc(estilo.nome)}</th><td><img src="${esc(`original/${nome}.jpg`)}"></td>${celulas.join('')}</tr>`
  }),
)
const rodape = modelos.map(modelo => {
  const doModelo = resultados.filter(r => r.modelo === modelo)
  const ok = doModelo.filter(r => r.status === 'ok')
  const media = ok.length ? ok.reduce((s, r) => s + r.ms, 0) / ok.length / 1000 : 0
  return `<td>média ${media.toFixed(1)} s · ${doModelo.filter(r => r.status === 'falha').length} falhas · ${doModelo.filter(r => r.status === 'recusa').length} recusas</td>`
})
const html = `<!doctype html><meta charset="utf-8"><title>Comparativo de modelos</title>
<style>body{font:14px system-ui;margin:16px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;vertical-align:top;text-align:left}img{width:260px;display:block}small{display:block;color:#666}.erro{color:#a00;max-width:260px}</style>
<table><thead><tr><th>Foto / estilo</th><th>original</th>${modelos.map(m => `<th>${esc(m)}</th>`).join('')}</tr></thead>
<tbody>${linhas.join('\n')}</tbody><tfoot><tr><th colspan="2">Resumo</th>${rodape.join('')}</tr></tfoot></table>`
fs.writeFileSync(path.join(dirResultado, 'index.html'), html)
console.log(`Painel: ${path.join(dirResultado, 'index.html')}`)
