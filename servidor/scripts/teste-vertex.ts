// Chamada de teste: confirma que o crédito do Google Cloud libera cada modelo de imagem.
// Uso (dentro de servidor/): npm run teste-vertex -- [modelo...]
// Usa a primeira foto de comparativo/fotos/ e o estilo mona-lisa; grava em comparativo/teste/<modelo>.jpg.
import path from 'node:path'
import { carregarCatalogo } from '../src/estilos/catalogo.js'
import { criarProvedorVertex } from '../src/provedores/vertex.js'
import { DIR_COMPARATIVO, DIR_ESTILOS, gravarJpeg, lerFotos, lerGoogle, MODELOS_PADRAO } from './vertex-comum.js'

const ESTILO = 'mona-lisa'

const google = lerGoogle()
const modelos = process.argv.slice(2).length > 0 ? process.argv.slice(2) : MODELOS_PADRAO
const estilo = carregarCatalogo(DIR_ESTILOS, console.warn).buscar(ESTILO)
if (!estilo) {
  console.error(`Estilo "${ESTILO}" não encontrado em ${DIR_ESTILOS}`)
  process.exit(2)
}
const [{ nome, foto }] = await lerFotos()

console.log(`Projeto ${google.projeto} (${google.local}), foto "${nome}", estilo ${ESTILO}`)
let falhas = 0
for (const modelo of modelos) {
  const inicio = Date.now()
  try {
    const imagem = await criarProvedorVertex({ ...google, modelo }).pintar(foto, estilo)
    const destino = path.join(DIR_COMPARATIVO, 'teste', `${modelo}.jpg`)
    await gravarJpeg(imagem, destino)
    console.log(`OK    ${modelo}: ${((Date.now() - inicio) / 1000).toFixed(1)} s → ${destino}`)
  } catch (e) {
    falhas++
    console.log(`FALHA ${modelo}: ${(e as Error).name}: ${(e as Error).message}`)
  }
}
console.log(falhas === 0 ? 'Todos os modelos responderam. Confira o desconto em Faturamento → Créditos.' : `${falhas} modelo(s) falharam.`)
process.exitCode = falhas === 0 ? 0 : 1
