// Vitrine (Decisão 12): monta uma tela com estado fixo, para o inspetor fotografar sem passar pelo fluxo.
// Só entra no build com --mode vitrine. Uso: vitrine.html?tela=inicio | inicio&evento=inativo | quadros | foto
import './estilos.css'
import { buscarEstilos } from './api'
import { estado, irPara } from './navegacao'
import { montarInicio } from './telas/inicio'
import { registrarTelas } from './telas/registro'

registrarTelas()
const parametros = new URLSearchParams(location.search)
const tela = parametros.get('tela') ?? 'inicio'

switch (tela) {
  case 'inicio':
    document.body.dataset.tela = 'inicio'
    montarInicio(document.querySelector<HTMLElement>('#app')!, { eventoAtivo: parametros.get('evento') !== 'inativo' })
    break
  case 'quadros':
    irPara('quadros')
    break
  case 'foto':
    estado.estilo = (await buscarEstilos())[0]
    irPara('foto')
    break
  default:
    document.body.textContent = `Estado desconhecido: ${tela}`
}
