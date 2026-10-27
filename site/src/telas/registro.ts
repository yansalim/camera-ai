import { registrarTela } from '../navegacao'
import { montarFoto } from './foto'
import { montarInicio } from './inicio'
import { montarQuadros } from './quadros'

/** Liga cada tela à sua função de montagem. Importado pelo site e pela vitrine. */
export function registrarTelas(): void {
  registrarTela('inicio', raiz => montarInicio(raiz))
  registrarTela('quadros', montarQuadros)
  registrarTela('foto', montarFoto)
}
