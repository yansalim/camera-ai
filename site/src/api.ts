import type { Aceite } from './aceite'

export interface EstiloPublico {
  id: string
  nome: string
  legenda: string
  frases: string[]
  miniaturaUrl: string
}

export interface ResultadoPintura {
  imagem: Blob
  codigo: string | null
}

export class ErroPintura extends Error {
  override name = 'ErroPintura'
  constructor(
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem)
  }
}

const semInternet = () => new ErroPintura('SEM_INTERNET', 'Parece que a internet caiu. Tente de novo.')
const tempoEsgotado = () => new ErroPintura('TEMPO_ESGOTADO', 'Demorou mais que o normal. Tente de novo.')
const iaIndisponivel = () => new ErroPintura('IA_INDISPONIVEL', 'A pintora está com dificuldades. Tente de novo.')

/** Transforma a resposta de erro do servidor ({ erro, mensagem }) em ErroPintura. */
export function interpretarErro(_status: number, corpo: string): ErroPintura {
  try {
    const j = JSON.parse(corpo) as { erro?: unknown; mensagem?: unknown }
    if (typeof j.erro === 'string' && typeof j.mensagem === 'string') return new ErroPintura(j.erro, j.mensagem)
  } catch {
    // corpo que não é JSON (proxy, página de erro): cai no genérico
  }
  return iaIndisponivel()
}

async function buscarJson<T>(url: string): Promise<T> {
  let r: Response
  try {
    r = await fetch(url)
  } catch {
    throw semInternet()
  }
  if (!r.ok) throw interpretarErro(r.status, await r.text())
  return r.json() as Promise<T>
}

export const buscarEstilos = () => buscarJson<EstiloPublico[]>('/api/estilos')
export const buscarSaude = () => buscarJson<{ eventoAtivo: boolean }>('/api/saude')

/**
 * Envia a foto para pintar. Usa XMLHttpRequest para saber quando o envio terminou:
 * envio que não termina em 30 s ou resposta que não chega em 100 s viram TEMPO_ESGOTADO.
 */
export function pintar(
  d: { foto: Blob; estiloId: string; aceite: Aceite; idAparelho: string },
  o: { tempoEnvioMs?: number; tempoTotalMs?: number } = {},
): Promise<ResultadoPintura> {
  const { tempoEnvioMs = 30_000, tempoTotalMs = 100_000 } = o
  const form = new FormData()
  form.append('estiloId', d.estiloId)
  form.append('termosVersao', d.aceite.termosVersao)
  form.append('aceiteEm', d.aceite.aceiteEm)
  form.append('foto', d.foto, 'foto.jpg')

  return new Promise((resolver, rejeitar) => {
    const xhr = new XMLHttpRequest()
    let encerrado = false
    const timers: number[] = []
    const fim = (acao: () => void) => {
      if (encerrado) return
      encerrado = true
      timers.forEach(t => clearTimeout(t))
      acao()
    }
    const estourar = () =>
      fim(() => {
        xhr.abort()
        rejeitar(tempoEsgotado())
      })

    xhr.open('POST', '/api/pintar')
    xhr.responseType = 'blob'
    xhr.setRequestHeader('X-Aparelho', d.idAparelho)
    xhr.upload.addEventListener('load', () => clearTimeout(timers[0]))
    xhr.addEventListener('error', () => fim(() => rejeitar(semInternet())))
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        fim(() => resolver({ imagem: xhr.response as Blob, codigo: xhr.getResponseHeader('X-Codigo-Obra') }))
      } else {
        ;(xhr.response as Blob)
          .text()
          .then(corpo => fim(() => rejeitar(interpretarErro(xhr.status, corpo))))
          .catch(() => fim(() => rejeitar(iaIndisponivel())))
      }
    })
    timers.push(window.setTimeout(estourar, tempoEnvioMs), window.setTimeout(estourar, tempoTotalMs))
    xhr.send(form)
  })
}
