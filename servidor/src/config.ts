export interface Config {
  porta: number
  provedor: string
  google: { projeto?: string; local: string; modelo?: string }
  eventoAtivo: boolean
  limiteAparelho: { max: number; janelaMs: number }
  limiteIp: { max: number; janelaMs: number }
  tetoDiario: number
  concorrencia: number
  tempoMaximoMs: number
  estilosDir: string
  acervoDir: string
}

type Ambiente = Record<string, string | undefined>

/** Inteiro positivo da variável, ou o padrão quando ela não existe. */
function inteiro(env: Ambiente, nome: string, padrao: number): number {
  const bruto = env[nome]
  if (bruto === undefined || bruto === '') return padrao
  const n = Number(bruto)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Variável ${nome} inválida: ${bruto}`)
  return n
}

function texto(env: Ambiente, nome: string): string | undefined {
  const v = env[nome]?.trim()
  return v ? v : undefined
}

export function lerConfig(env: Ambiente): Config {
  const provedor = texto(env, 'PROVEDOR') ?? 'falso'
  const projeto = texto(env, 'GOOGLE_CLOUD_PROJECT')
  const modelo = texto(env, 'MODELO_IMAGEM')
  if (provedor === 'vertex') {
    if (!projeto) throw new Error('Variável GOOGLE_CLOUD_PROJECT inválida: obrigatória com PROVEDOR=vertex')
    if (!modelo) throw new Error('Variável MODELO_IMAGEM inválida: obrigatória com PROVEDOR=vertex')
  }
  const minutos = 60_000
  return {
    porta: inteiro(env, 'PORTA', 3000),
    provedor,
    google: {
      ...(projeto ? { projeto } : {}),
      local: texto(env, 'GOOGLE_CLOUD_LOCATION') ?? 'global',
      ...(modelo ? { modelo } : {}),
    },
    eventoAtivo: env.EVENTO_ATIVO === 'true',
    limiteAparelho: { max: inteiro(env, 'LIMITE_APARELHO', 5), janelaMs: inteiro(env, 'JANELA_APARELHO_MIN', 10) * minutos },
    limiteIp: { max: inteiro(env, 'LIMITE_IP', 60), janelaMs: inteiro(env, 'JANELA_IP_MIN', 60) * minutos },
    tetoDiario: inteiro(env, 'TETO_DIARIO', 1000),
    concorrencia: inteiro(env, 'CONCORRENCIA', 5),
    tempoMaximoMs: inteiro(env, 'TEMPO_MAXIMO_S', 90) * 1000,
    estilosDir: texto(env, 'ESTILOS_DIR') ?? '../estilos',
    acervoDir: texto(env, 'ACERVO_DIR') ?? '../dados/acervo',
  }
}
