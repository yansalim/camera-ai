import { registrarTela } from '../navegacao'
import { montarErro } from './erro'
import { montarFoto } from './foto'
import { montarInicio } from './inicio'
import { montarQuadros } from './quadros'
import { montarResultado } from './resultado'
import { montarRevelacao } from './revelacao'

/** Liga cada tela à sua função de montagem. Importado pelo site e pela vitrine. */
export function registrarTelas(): void {
  registrarTela('inicio', raiz => montarInicio(raiz))
  registrarTela('quadros', montarQuadros)
  registrarTela('foto', montarFoto)
  registrarTela('revelacao', raiz => montarRevelacao(raiz))
  registrarTela('resultado', raiz => montarResultado(raiz))
  registrarTela('erro', montarErro)
}
