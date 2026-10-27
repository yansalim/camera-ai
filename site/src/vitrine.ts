// Vitrine (Decisão 12): monta uma tela com estado fixo, para o inspetor fotografar sem passar pelo fluxo.
// Só entra no build com --mode vitrine. Estados: inicio, inicio&evento=inativo, quadros, foto, revelacao,
// resultado, resultado&versao=so-pintura, resultado&dica=ios, erro&codigo=LIMITE_APARELHO|RECUSADA|EVENTO_INATIVO.
import './estilos.css'
import pinturaUrl from '../test/fixtures/pintura-exemplo.jpg?url'
import selfieUrl from '../test/fixtures/selfie.jpg?url'
import { buscarEstilos, ErroPintura } from './api'
import { CONFIG } from './config'
import { comporMoldura } from './moldura'
import { estado, irPara } from './navegacao'
import { montarErro } from './telas/erro'
import { montarInicio } from './telas/inicio'
import { registrarTelas } from './telas/registro'
import { montarResultado } from './telas/resultado'
import { montarRevelacao } from './telas/revelacao'

const MENSAGENS: Record<string, string> = {
  LIMITE_APARELHO: 'Calma, artista! Espere alguns minutinhos para pintar de novo.',
  RECUSADA: 'Não consegui pintar essa foto. Que tal tentar outra?',
  EVENTO_INATIVO: 'Esta experiência está disponível no estande.',
}

const baixar = async (url: string) => (await fetch(url)).blob()
const raiz = document.querySelector<HTMLElement>('#app')!
const marcar = (tela: string) => {
  document.body.dataset.tela = tela
}

registrarTelas()
const parametros = new URLSearchParams(location.search)
const tela = parametros.get('tela') ?? 'inicio'
if (tela !== 'inicio') estado.estilo = (await buscarEstilos())[0]

switch (tela) {
  case 'inicio':
    marcar('inicio')
    montarInicio(raiz, { eventoAtivo: parametros.get('evento') !== 'inativo' })
    break
  case 'quadros':
  case 'foto':
    irPara(tela)
    break
  case 'revelacao':
    estado.foto = await baixar(selfieUrl)
    marcar('revelacao')
    await montarRevelacao(raiz, { pedir: false })
    break
  case 'resultado': {
    estado.foto = await baixar(selfieUrl)
    const imagem = await baixar(pinturaUrl)
    estado.resultado = { imagem, codigo: 'K7M-3PX' }
    estado.comMoldura = await comporMoldura(imagem, CONFIG.assinatura)
    marcar('resultado')
    montarResultado(raiz, { versao: parametros.get('versao') === 'so-pintura' ? 'pintura' : 'moldura', dicaIos: parametros.get('dica') === 'ios' })
    break
  }
  case 'erro': {
    const codigo = parametros.get('codigo') ?? 'LIMITE_APARELHO'
    estado.foto = await baixar(selfieUrl)
    marcar('erro')
    montarErro(raiz, { erro: new ErroPintura(codigo, MENSAGENS[codigo] ?? 'A pintora está com dificuldades. Tente de novo.') })
    break
  }
  default:
    document.body.textContent = `Estado desconhecido: ${tela}`
}
