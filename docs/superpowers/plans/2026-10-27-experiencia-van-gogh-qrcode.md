# Experiência "Vire uma pintura de Van Gogh" — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site acessado por QR code em que o visitante aceita os termos, escolhe um quadro, tira uma foto com a câmera nativa e recebe a foto repintada por IA generativa no estilo do quadro, com o par foto/pintura guardado num acervo na VPS.

**Architecture:** Site estático (Vite + TypeScript, sem framework) servido pelo Caddy, que também faz proxy de `/api/*` para o serviço "pintor" (Node.js + Fastify). O pintor lê o catálogo de estilos de `estilos/`, aplica as proteções (interruptor de evento, limites, teto diário, fila), chama a IA por um adaptador de provedor e grava o acervo em `dados/acervo/`. Tudo sobe com Docker Compose.

**Tech Stack:** Node.js 22 LTS, TypeScript (strict, ESM, `moduleResolution: NodeNext`), Fastify 5 + `@fastify/multipart`, `sharp`, Vitest (servidor em Node; site em modo navegador com Playwright/Chromium), Playwright (e2e), Vite, Caddy 2, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-27-experiencia-van-gogh-qrcode-design.md`

## Global Constraints

- Interface toda em português do Brasil; mensagens de erro exatamente como na tabela da seção 7 da spec.
- Chave de API de IA só no servidor (variável de ambiente); nunca no site.
- `dados/acervo/` nunca exposto por HTTP (o contêiner do Caddy não monta essa pasta).
- O IP do visitante não é gravado no acervo.
- Foto no site: lado maior ≤ 1600 px, JPEG qualidade 0,85, rotação EXIF aplicada.
- Upload aceito pelo servidor: até 5 MB; o servidor reencoda para JPEG sem metadados.
- Padrões: limite por aparelho 5 / 10 min; por IP 60 / hora; teto diário 1.000; fila com 5 simultâneos; tempo máximo no servidor 90 s; no site, 30 s para o envio e 100 s no total.
- Pastas do acervo por data no fuso `America/Sao_Paulo`: `dados/acervo/AAAA-MM-DD/<código>/{original.jpg, pintura.jpg, info.json}`.
- Código da obra: `XXX-XXX` com alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sem 0, O, 1, I, L).
- Versão atual dos termos: `v1`.
- Campos do multipart: `foto`, `estiloId`, `termosVersao`, `aceiteEm`. Cabeçalho de entrada `X-Aparelho`; de saída `X-Codigo-Obra`.

## Decisões tomadas neste plano (complementam a spec)

1. **Validação antes dos limites.** A spec 6.3 diz que os limites contam só pedidos válidos; a ordem é: interruptor → aceite → estilo → foto → limites → teto → fila → provedor → acervo.
2. **Novo código de erro `ACEITE_AUSENTE`** (400, "Volte ao início e toque em \"Quero criar minha foto\"."), para pedidos sem `termosVersao`/`aceiteEm` válidos — o acervo exige registro de aceite.
3. **Pedido sem `X-Aparelho`** usa o IP como chave do limite por aparelho.
4. **Falha ao gravar no acervo** (ex.: disco cheio) não estraga a experiência: o visitante recebe a pintura sem `X-Codigo-Obra` e o erro vai para o log.
5. **Moldura desenhada por código** (gradientes dourados no canvas) em vez de um PNG — não depende de arte externa; trocar o visual é editar `moldura.ts`.
6. **Revelação dura no mínimo 4 s**, mesmo se a IA responder antes (suspense).
7. **"Com moldura" é a versão exibida primeiro** no resultado.
8. **Prompts dos estilos em inglês** (melhor aderência dos modelos de imagem).
9. **"Salvar" no iPhone abre a imagem em tela cheia** com a dica "Toque e segure a imagem para salvar" (o download do Safari vai para Arquivos, não para Fotos).
10. **Script do comparativo em `servidor/scripts/`** (reusa catálogo e adaptadores do servidor).

## Review Focus

1. **Muitos visitantes atrás do mesmo IP (Wi-Fi do evento) e o pintor atrás do Caddy** — sem `trustProxy`, todos os pedidos parecem vir do IP do Caddy e o limite de 60/h trava o evento inteiro. Teste na Task 8 (`X-Forwarded-For` distintos contam separado).
2. **Toque duplo em "Tentar de novo" / envio repetido** — deve sair um único pedido (gasto e limites dobrados). Teste e2e na Task 12.
3. **IA responde depois do tempo esgotado** — a resposta tardia não pode ser gravada no acervo nem contar no teto. Teste na Task 8.
4. **Falha ao gravar o acervo** — o visitante ainda recebe a pintura. Teste na Task 8.
5. **`localStorage` indisponível** (aba anônima, navegador embutido) — aceite e identificador do aparelho caem para memória e o fluxo continua. Teste na Task 9.

---

## Estrutura de arquivos

```
.gitignore
estilos/
  LEIA-ME.md                         como incluir um estilo
  noite-estrelada/ girassois/ terraco-do-cafe/ autorretrato/
    estilo.json  miniatura.jpg  referencia.jpg
servidor/
  package.json  tsconfig.json  vitest.config.ts
  src/
    index.ts                         ponto de entrada (monta dependências, escuta a porta)
    config.ts                        lerConfig(env)
    erros.ts                         ErroApi + tabela de códigos/status/mensagens
    app.ts                           construirApp(deps)
    rotas/estilos.ts  rotas/saude.ts  rotas/pintar.ts
    estilos/catalogo.ts              módulo de estilos
    acervo/codigo.ts  acervo/acervo.ts
    protecao/limitador.ts  protecao/teto-diario.ts  protecao/fila.ts
    imagem/imagem.ts                 prepararFoto, paraJpeg (sharp)
    provedores/tipos.ts              Provedor, ErroRecusa, ErroTemporario
    provedores/prompt.ts             montarPrompt
    provedores/nova-tentativa.ts     comNovaTentativa
    provedores/falso.ts              provedor de teste
    provedores/http.ts               classificarStatus
    provedores/<escolhido>.ts        adaptador real (Task 3)
    provedores/index.ts              criarProvedor(config)
  scripts/preparar-estilo.ts         gera miniatura/referência de um estilo
  scripts/comparativo.ts             teste comparativo de provedores
  test/…                             Vitest
site/
  package.json  tsconfig.json  vite.config.ts  vitest.config.ts  playwright.config.ts
  index.html  termos.html
  src/
    main.ts                          navegação entre telas + estado
    config.ts                        escola, e-mail, assinatura, versão dos termos
    armazenamento.ts                 localStorage com fallback em memória
    aceite.ts  api.ts  foto.ts  moldura.ts  compartilhar.ts
    telas/inicio.ts  telas/quadros.ts  telas/foto.ts  telas/revelacao.ts  telas/resultado.ts  telas/erro.ts
    estilos.css
  test/…  test/fixtures/gerar.mjs    Vitest (navegador) + gerador de fixtures
  e2e/…                              Playwright
deploy/
  docker-compose.yml  Caddyfile  pintor.Dockerfile  caddy.Dockerfile  .env.exemplo
scripts/
  package.json  backup-acervo.sh  gerar-qrcode.mjs
docs/
  checklist-evento.md  validacao-campo.md
```

---

### Task 1: Servidor base + módulo de estilos com os 4 quadros

**Files:**
- Create: `.gitignore`, `servidor/package.json`, `servidor/tsconfig.json`, `servidor/vitest.config.ts`
- Create: `servidor/src/estilos/catalogo.ts`, `servidor/scripts/preparar-estilo.ts`
- Create: `estilos/LEIA-ME.md`, `estilos/{noite-estrelada,girassois,terraco-do-cafe,autorretrato}/{estilo.json,miniatura.jpg,referencia.jpg}`
- Test: `servidor/test/catalogo.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Estilo { id: string; nome: string; artista: string; prompt: string; ordem: number; ativo: boolean; caminhoMiniatura: string; caminhoReferencia?: string }
  export interface Catalogo { ativos(): Estilo[]; buscar(id: string): Estilo | undefined } // buscar só encontra ativos
  export function carregarCatalogo(dir: string, avisar: (msg: string) => void): Catalogo
  ```

- [ ] **Step 1: Criar o esqueleto do servidor.** `package.json` com `"type": "module"`, scripts `dev` (`tsx watch src/index.ts`), `build` (`tsc`), `start` (`node dist/index.js`), `test` (`vitest run`); dependências `fastify`, `@fastify/multipart`, `sharp`; dev `typescript`, `tsx`, `vitest`, `@types/node`. `tsconfig` strict, `module`/`moduleResolution` `NodeNext`, `outDir: dist`, `rootDir: .`. `.gitignore` na raiz: `node_modules/`, `dist/`, `dados/`, `.env`, `servidor/comparativo/`, `site/e2e/.acervo/`, `site/test-results/`, `site/playwright-report/`.

- [ ] **Step 2: Escrever os testes do catálogo** (cada teste monta um diretório temporário com `fs.mkdtemp`):

```ts
it('carrega estilos válidos em ordem e esconde inativos', () => {
  // pastas: b (ordem 2), a (ordem 1), c (ativo: false), todas com miniatura.jpg
  const cat = carregarCatalogo(dir, avisar)
  expect(cat.ativos().map(e => e.id)).toEqual(['a', 'b'])
  expect(cat.buscar('c')).toBeUndefined()
  expect(cat.buscar('a')?.caminhoMiniatura).toBe(path.join(dir, 'a', 'miniatura.jpg'))
})
it('ignora pasta sem miniatura e avisa', () => { /* … */ expect(avisar).toHaveBeenCalledWith(expect.stringContaining('sem-miniatura')) })
it('ignora estilo.json malformado e avisa', () => { /* JSON inválido */ })
it('ignora estilo.json sem campo obrigatório (prompt)', () => { /* … */ })
it('preenche caminhoReferencia só quando referencia.jpg existe', () => { /* … */ })
it('o catálogo real tem os 4 quadros na ordem', () => {
  const cat = carregarCatalogo(path.resolve('../estilos'), avisar)
  expect(cat.ativos().map(e => e.id)).toEqual(['noite-estrelada', 'girassois', 'terraco-do-cafe', 'autorretrato'])
})
```

- [ ] **Step 3: Rodar e ver falhar.** Run: `npm --prefix servidor test` — Expected: FAIL (`carregarCatalogo` não existe).

- [ ] **Step 4: Implementar `carregarCatalogo` em `servidor/src/estilos/catalogo.ts`.** Leitura síncrona; o `id` é o nome da pasta; campos obrigatórios `nome`, `artista`, `prompt` (string), `ordem` (number), `ativo` (boolean); pasta inválida → `avisar(\`Estilo "<id>" ignorado: <motivo>\`)` e segue.

- [ ] **Step 5: Implementar `servidor/scripts/preparar-estilo.ts`** — uso: `npx tsx scripts/preparar-estilo.ts <imagem-do-quadro> <pasta-do-estilo>`; gera `miniatura.jpg` (lado maior 480 px, qualidade 80) e `referencia.jpg` (lado maior 1024 px, qualidade 85) com `sharp`.

- [ ] **Step 6: Criar os 4 estilos.** Imagens dos quadros: Wikimedia Commons (domínio público) — **pedir confirmação ao usuário antes de baixar**, informando arquivo e origem; baixar para uma pasta temporária e passar pelo `preparar-estilo.ts`. Quadros: A Noite Estrelada (1889), Girassóis (1888, National Gallery), Terraço do Café à Noite (1888), Autorretrato (1889, Musée d'Orsay). Todos com `"artista": "Vincent van Gogh"`, `"ativo": true`, `ordem` 1–4 na ordem acima. Prompts:
  - `noite-estrelada`: "Repaint this photo as a Vincent van Gogh oil painting in the style of The Starry Night (1889): thick impasto brushstrokes, swirling deep-blue sky with glowing yellow stars and crescent moon, dynamic curving lines, richly textured paint."
  - `girassois`: "Repaint this photo as a Vincent van Gogh oil painting in the style of Sunflowers (1888): warm chrome-yellow and ochre palette, thick impasto, bold visible brushstrokes, simple yellow background, sunflowers framing the scene."
  - `terraco-do-cafe`: "Repaint this photo as a Vincent van Gogh oil painting in the style of Café Terrace at Night (1888): warm yellow-orange gaslight against a deep blue starry sky, cobblestone textures, thick expressive brushstrokes, strong yellow and blue contrast."
  - `autorretrato`: "Repaint this photo as a Vincent van Gogh oil painting in the style of his Self-Portrait (1889, Musée d'Orsay): swirling pale blue-green background with rhythmic wavy brushstrokes, short directional strokes modelling the face, cool palette with orange accents, thick impasto."

- [ ] **Step 7: Escrever `estilos/LEIA-ME.md`** — passo a passo: copiar uma pasta, editar `estilo.json`, rodar `preparar-estilo.ts` com a imagem do novo quadro, `docker compose restart pintor`; `"ativo": false` para esconder.

- [ ] **Step 8: Rodar e ver passar.** Run: `npm --prefix servidor test` — Expected: PASS (6 testes).

- [ ] **Step 9: Commit.** `git add .gitignore servidor estilos && git commit -m "feat(servidor): módulo de estilos com os 4 quadros"`

---

### Task 2: Interface de provedor, prompt, nova tentativa e provedor falso

**Files:**
- Create: `servidor/src/provedores/{tipos.ts,prompt.ts,nova-tentativa.ts,falso.ts,index.ts}`, `servidor/src/config.ts`
- Test: `servidor/test/provedores.test.ts`, `servidor/test/config.test.ts`

**Interfaces:**
- Consumes: `Estilo` (Task 1).
- Produces:
  ```ts
  // tipos.ts
  export interface Provedor { readonly nome: string; readonly modelo: string; pintar(foto: Buffer, estilo: Estilo): Promise<Buffer> }
  export class ErroRecusa extends Error {}
  export class ErroTemporario extends Error {}
  // prompt.ts
  export function montarPrompt(estilo: Estilo, comReferencia: boolean): string
  // nova-tentativa.ts
  export function comNovaTentativa(p: Provedor): Provedor
  // falso.ts
  export function criarProvedorFalso(opcoes?: { atrasoMs?: number }): Provedor   // nome 'falso', modelo 'falso-1'
  // index.ts
  export function criarProvedor(config: Config): Provedor   // já embrulhado com comNovaTentativa
  // config.ts
  export interface Config {
    porta: number; provedor: string; chaves: Record<string, string | undefined>; eventoAtivo: boolean
    limiteAparelho: { max: number; janelaMs: number }; limiteIp: { max: number; janelaMs: number }
    tetoDiario: number; concorrencia: number; tempoMaximoMs: number; estilosDir: string; acervoDir: string
  }
  export function lerConfig(env: Record<string, string | undefined>): Config
  ```
  Variáveis: `PORTA`=3000, `PROVEDOR`=`falso`, `EVENTO_ATIVO`=`false`, `LIMITE_APARELHO`=5, `JANELA_APARELHO_MIN`=10, `LIMITE_IP`=60, `JANELA_IP_MIN`=60, `TETO_DIARIO`=1000, `CONCORRENCIA`=5, `TEMPO_MAXIMO_S`=90, `ESTILOS_DIR`=`../estilos`, `ACERVO_DIR`=`../dados/acervo`; chaves `GEMINI_API_KEY`, `FAL_KEY`, `OPENAI_API_KEY`.

- [ ] **Step 1: Escrever os testes:**

```ts
// config.test.ts
it('usa os padrões', () => { const c = lerConfig({}); expect(c).toMatchObject({ porta: 3000, provedor: 'falso', eventoAtivo: false, tetoDiario: 1000, concorrencia: 5, tempoMaximoMs: 90_000 }); expect(c.limiteAparelho).toEqual({ max: 5, janelaMs: 600_000 }); expect(c.limiteIp).toEqual({ max: 60, janelaMs: 3_600_000 }) })
it('liga o evento só com "true"', () => { expect(lerConfig({ EVENTO_ATIVO: 'true' }).eventoAtivo).toBe(true) })
it('recusa número inválido citando a variável', () => { expect(() => lerConfig({ TETO_DIARIO: 'abc' })).toThrow(/TETO_DIARIO/) })
// provedores.test.ts
it('montarPrompt junta o prompt do estilo com a instrução fixa', () => { const p = montarPrompt(estilo, false); expect(p).toContain(estilo.prompt); expect(p).toContain('recognizable'); expect(p).not.toContain('second image') })
it('montarPrompt menciona a referência quando há', () => { expect(montarPrompt(estilo, true)).toContain('second image') })
it('nova tentativa: temporário uma vez e depois sucesso', async () => { /* pintar chamado 2x, devolve o buffer */ })
it('nova tentativa: temporário duas vezes propaga ErroTemporario', async () => { /* 2 chamadas */ })
it('nova tentativa: recusa não repete', async () => { /* rejects ErroRecusa, 1 chamada */ })
it('nova tentativa: erro genérico não repete', async () => { /* 1 chamada */ })
it('falso devolve JPEG com as mesmas dimensões', async () => { const m = await sharp(await criarProvedorFalso().pintar(jpeg640x480, estilo)).metadata(); expect(m).toMatchObject({ format: 'jpeg', width: 640, height: 480 }) })
it('criarProvedor recusa provedor desconhecido', () => { expect(() => criarProvedor({ ...cfg, provedor: 'xyz' })).toThrow('Provedor desconhecido: xyz') })
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `npm --prefix servidor test` — Expected: FAIL nos novos testes.

- [ ] **Step 3: Implementar.** Instrução fixa do `montarPrompt` (texto exato): `"Keep the person's face, identity, expression, pose and the composition of the photo clearly recognizable. Output only the painting: no frame, no text, no signature."`; com referência acrescenta: `"The second image is the original painting: use it only as a style reference, do not copy its content."`. O falso aplica `sharp(foto).modulate({ saturation: 2 }).blur(2).jpeg()` após `atrasoMs` (padrão 0). `lerConfig` lança `Error('Variável <NOME> inválida: <valor>')`.

- [ ] **Step 4: Rodar e ver passar.** Run: `npm --prefix servidor test` — Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(servidor): interface de provedor, provedor falso e configuração"`

---

### Task 3: Adaptadores candidatos + teste comparativo (⏸ decisão do usuário)

Pode rodar em paralelo às Tasks 4–12, que usam o provedor `falso`. Precisa do usuário: chaves de API dos candidatos e ~10 fotos reais de pessoas que autorizaram o teste.

**Files:**
- Create: `servidor/src/provedores/{http.ts,gemini.ts,fal-kontext.ts,openai.ts}`, `servidor/scripts/comparativo.ts`
- Modify: `servidor/src/provedores/index.ts` (registrar candidatos), `servidor/package.json` (SDKs + script `comparativo`)
- Test: `servidor/test/adaptadores.test.ts`

**Interfaces:**
- Consumes: `Provedor`, `ErroRecusa`, `ErroTemporario`, `montarPrompt`, `carregarCatalogo`.
- Produces:
  ```ts
  export function classificarStatus(status: number, mensagem: string): Error   // 408, 429, 5xx → ErroTemporario; demais → Error
  export function criarProvedorGemini(chave: string, modelo?: string): Provedor        // padrão 'gemini-2.5-flash-image'
  export function criarProvedorFalKontext(chave: string, modelo?: string): Provedor    // padrão 'fal-ai/flux-pro/kontext'
  export function criarProvedorOpenAI(chave: string, modelo?: string): Provedor        // padrão 'gpt-image-1'
  export function interpretarGemini(resposta: unknown): Buffer      // sem imagem / bloqueio de segurança → ErroRecusa
  export function interpretarFalKontext(resposta: unknown): string   // URL da imagem; has_nsfw_concepts → ErroRecusa
  export function interpretarOpenAI(resposta: unknown): Buffer      // data[0].b64_json
  ```
  `PROVEDOR` aceita `gemini`, `fal-kontext`, `openai`, `falso`.

- [ ] **Step 1: Conferir a documentação atual** de cada provedor (SDKs `@google/genai`, `@fal-ai/client`, `openai`), confirmando ids de modelo, formato de entrada de imagem e campos de resposta. Se houver versão mais nova e compatível, incluí-la como candidata. Gemini e OpenAI recebem também `referencia.jpg` como segunda imagem; FLUX Kontext só o prompt.

- [ ] **Step 2: Escrever os testes com respostas de exemplo** (montadas a partir da documentação conferida):

```ts
it('classificarStatus: 429 e 503 são temporários, 400 não', () => { expect(classificarStatus(429, '')).toBeInstanceOf(ErroTemporario); expect(classificarStatus(503, '')).toBeInstanceOf(ErroTemporario); expect(classificarStatus(400, '')).not.toBeInstanceOf(ErroTemporario) })
it('Gemini: extrai a imagem inline', () => { expect(interpretarGemini(respostaComImagem)).toEqual(Buffer.from('img')) })
it('Gemini: bloqueio de segurança vira recusa', () => { expect(() => interpretarGemini(respostaBloqueada)).toThrow(ErroRecusa) })
it('Fal: devolve a URL da primeira imagem', () => { expect(interpretarFalKontext(resp)).toBe('https://…/a.jpg') })
it('Fal: conteúdo sinalizado vira recusa', () => { /* has_nsfw_concepts: [true] */ })
it('OpenAI: decodifica b64_json', () => { /* … */ })
```

- [ ] **Step 3: Rodar e ver falhar**, implementar os três adaptadores (erros de moderação → `ErroRecusa`; status HTTP via `classificarStatus`; falha de rede → `ErroTemporario`), **rodar e ver passar.** Run: `npm --prefix servidor test`.

- [ ] **Step 4: Implementar `servidor/scripts/comparativo.ts`** (`npm --prefix servidor run comparativo -- gemini fal-kontext openai`): lê `servidor/comparativo/fotos/*.jpg` (passadas por `prepararFoto` se a Task 6 já existir; senão, redimensionadas a 1600 px), roda cada provedor × estilo × foto com no máximo 3 chamadas simultâneas, grava em `servidor/comparativo/resultado/<provedor>/<estilo>/<foto>.jpg` e gera `servidor/comparativo/resultado/index.html`: uma linha por foto × estilo, colunas "original" + um provedor por coluna, rodapé com tempo médio, falhas e recusas por provedor. Ignora provedores sem chave no ambiente, avisando.

- [ ] **Step 5: Rodar o comparativo com o usuário.** Antes, informar quantas chamadas serão feitas (10 fotos × 4 estilos × N provedores) e pedir ok. Abrir o `index.html`; o usuário escolhe o provedor. Registrar escolha, tempo médio e custo por foto (consultado no painel do provedor) em `docs/decisoes.md`.

- [ ] **Step 6: Manter só o escolhido.** Remover os adaptadores, testes e SDKs não escolhidos; `criarProvedor` aceita apenas o escolhido e `falso`. Run: `npm --prefix servidor test` — Expected: PASS.

- [ ] **Step 7: Commit.** `git commit -m "feat(servidor): adaptador do provedor escolhido no comparativo"`

---

### Task 4: Acervo (código da obra e gravação)

**Files:**
- Create: `servidor/src/acervo/codigo.ts`, `servidor/src/acervo/acervo.ts`
- Test: `servidor/test/acervo.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
  export function gerarCodigo(aleatorio?: () => number): string   // 'XXX-XXX'
  export function dataLocal(d: Date): string                         // 'AAAA-MM-DD' em America/Sao_Paulo
  export interface RegistroObra { estiloId: string; estiloNome: string; provedor: string; modelo: string; termosVersao: string; aceiteEm: string }
  export interface Acervo { gravar(original: Buffer, pintura: Buffer, registro: RegistroObra): Promise<string>; contarHoje(): Promise<number> }
  export function criarAcervo(opcoes: { dir: string; agora?: () => Date; aleatorio?: () => number }): Acervo
  ```

- [ ] **Step 1: Escrever os testes:**

```ts
it('gerarCodigo segue o formato e o alfabeto', () => { for (let i = 0; i < 200; i++) expect(gerarCodigo()).toMatch(/^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/) })
it('dataLocal usa o fuso de São Paulo', () => { expect(dataLocal(new Date('2026-11-21T02:30:00Z'))).toBe('2026-11-20') })
it('gravar cria a pasta com os 3 arquivos', async () => {
  const codigo = await acervo.gravar(Buffer.from('o'), Buffer.from('p'), registro)
  const pasta = path.join(dir, '2026-11-20', codigo)
  expect((await fs.readdir(pasta)).sort()).toEqual(['info.json', 'original.jpg', 'pintura.jpg'])
  const info = JSON.parse(await fs.readFile(path.join(pasta, 'info.json'), 'utf8'))
  expect(info).toEqual({ codigo, criadoEm: '2026-11-20T15:00:00.000Z', ...registro })
})
it('sorteia de novo se o código já existe', async () => {
  // aleatorio devolve a mesma sequência duas vezes e depois outra
  const c1 = await acervo.gravar(o, p, registro); const c2 = await acervo.gravar(o, p, registro)
  expect(c2).not.toBe(c1); expect(await fs.readdir(path.join(dir, '2026-11-20'))).toHaveLength(2)
})
it('contarHoje conta só as obras de hoje e ignora temporárias', async () => {
  // existem: 2026-11-19/AAA-AAA, 2026-11-20/BBB-BBB, 2026-11-20/.tmp-CCC-CCC
  expect(await acervo.contarHoje()).toBe(1)
})
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `npm --prefix servidor test` — Expected: FAIL.

- [ ] **Step 3: Implementar.** `gravar` escreve em `<dir>/<data>/.tmp-<codigo>/` e só então renomeia para `<codigo>/` (obra nunca fica pela metade); colisão = já existe `<dir>/*/<codigo>`. `criadoEm` = `agora().toISOString()`. `dataLocal` via `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })`.

- [ ] **Step 4: Rodar e ver passar.** Run: `npm --prefix servidor test` — Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(servidor): acervo com código da obra"`

---

### Task 5: Proteções (limitador, teto diário, fila)

**Files:**
- Create: `servidor/src/protecao/{limitador.ts,teto-diario.ts,fila.ts}`
- Test: `servidor/test/protecao.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Limitador { tentar(chave: string): boolean }   // true = permitido e contado
  export function criarLimitador(o: { max: number; janelaMs: number; agora?: () => number }): Limitador
  export interface TetoDiario { reservar(): boolean; confirmar(): void; liberar(): void; gravadasHoje(): number }
  export function criarTetoDiario(o: { teto: number; contagemInicial: number; hoje: () => string }): TetoDiario
  export interface Fila { executar<T>(tarefa: () => Promise<T>): Promise<T>; tamanho(): number }   // tamanho = esperando + executando
  export function criarFila(concorrencia: number): Fila
  ```

- [ ] **Step 1: Escrever os testes:**

```ts
it('limitador: permite max na janela e bloqueia o seguinte', () => { /* max 5: 5×true, 6º false */ })
it('limitador: libera depois da janela', () => { /* avança agora() em janelaMs+1 → true */ })
it('limitador: chaves são independentes', () => { /* … */ })
it('teto: em andamento conta para o teto', () => { const t = criarTetoDiario({ teto: 2, contagemInicial: 1, hoje }); expect(t.reservar()).toBe(true); expect(t.reservar()).toBe(false) })
it('teto: liberar devolve a vaga; confirmar soma em gravadasHoje', () => { /* … */ })
it('teto: zera gravadas quando o dia muda', () => { /* hoje() passa de '2026-11-20' para '2026-11-21' → gravadasHoje() 0 */ })
it('fila: nunca passa da concorrência e respeita a ordem', async () => { /* 10 tarefas, concorrência 3: pico observado 3, ordem de início 0..9 */ })
it('fila: tarefa que falha libera a vaga', async () => { /* … */ })
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `npm --prefix servidor test` — Expected: FAIL.

- [ ] **Step 3: Implementar** (janela deslizante com lista de instantes por chave, podada a cada `tentar`; fila própria, sem dependência).

- [ ] **Step 4: Rodar e ver passar.** Run: `npm --prefix servidor test` — Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(servidor): limitador, teto diário e fila"`

---

### Task 6: Preparo de imagens no servidor

**Files:**
- Create: `servidor/src/imagem/imagem.ts`
- Test: `servidor/test/imagem.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export class ErroFotoInvalida extends Error {}
  export async function prepararFoto(entrada: Buffer): Promise<Buffer>   // auto-rotação, lado maior ≤ 1600, JPEG q85, sem metadados
  export async function paraJpeg(entrada: Buffer): Promise<Buffer>        // normaliza a saída da IA para JPEG q90
  ```

- [ ] **Step 1: Escrever os testes** (imagens geradas com `sharp` no próprio teste):

```ts
it('remove metadados (EXIF/GPS)', async () => { const m = await sharp(await prepararFoto(jpegComExif)).metadata(); expect(m.exif).toBeUndefined() })
it('reduz para no máximo 1600 px', async () => { const m = await sharp(await prepararFoto(jpeg4000x3000)).metadata(); expect([m.width, m.height]).toEqual([1600, 1200]) })
it('aplica a orientação EXIF', async () => { /* 400×300 com orientation 6 → 300×400 */ })
it('recusa o que não é imagem', async () => { await expect(prepararFoto(Buffer.from('texto'))).rejects.toBeInstanceOf(ErroFotoInvalida) })
it('paraJpeg converte PNG', async () => { expect((await sharp(await paraJpeg(png)).metadata()).format).toBe('jpeg') })
```

- [ ] **Step 2: Rodar e ver falhar**, **Step 3: implementar** (`sharp(entrada).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 })`; erro de decodificação → `ErroFotoInvalida`), **Step 4: rodar e ver passar.** Run: `npm --prefix servidor test`.

- [ ] **Step 5: Commit.** `git commit -m "feat(servidor): validação e preparo de imagens"`

---

### Task 7: App Fastify, erros, rotas de estilos e saúde, ponto de entrada

**Files:**
- Create: `servidor/src/{erros.ts,app.ts,index.ts}`, `servidor/src/rotas/{estilos.ts,saude.ts}`
- Create: `servidor/test/ajudantes.ts`
- Test: `servidor/test/rotas-basicas.test.ts`

**Interfaces:**
- Consumes: `Config`, `lerConfig`, `Catalogo`, `Provedor`, `Acervo`, `Limitador`, `TetoDiario`, `Fila`.
- Produces:
  ```ts
  export type CodigoErro = 'EVENTO_INATIVO' | 'LIMITE_APARELHO' | 'LIMITE_IP' | 'TETO_DIARIO' | 'FOTO_INVALIDA' | 'ESTILO_INVALIDO' | 'ACEITE_AUSENTE' | 'RECUSADA' | 'IA_INDISPONIVEL' | 'TEMPO_ESGOTADO'
  export const ERROS: Record<CodigoErro, { status: number; mensagem: string }>   // seção 7 da spec + ACEITE_AUSENTE (400)
  export class ErroApi extends Error { constructor(public readonly codigo: CodigoErro) }
  export interface Dependencias { config: Config; catalogo: Catalogo; provedor: Provedor; acervo: Acervo; limitadorAparelho: Limitador; limitadorIp: Limitador; teto: TetoDiario; fila: Fila }
  export function construirApp(deps: Dependencias): FastifyInstance   // trustProxy: true
  // test/ajudantes.ts
  export async function criarAppDeTeste(sobrescritas?: { config?: Partial<Config>; provedor?: Provedor; acervo?: Acervo }): Promise<{ app: FastifyInstance; acervoDir: string; deps: Dependencias }>
  export async function montarFormulario(campos: Record<string, string | Buffer>): Promise<{ payload: Buffer; headers: Record<string, string> }>
  ```
  Respostas de erro: `{ erro: CodigoErro, mensagem: string }`. Erro desconhecido → 500 com a mensagem de `IA_INDISPONIVEL`. Arquivo acima de 5 MB (`FST_REQ_FILE_TOO_LARGE`) → `FOTO_INVALIDA`.

- [ ] **Step 1: Escrever os testes:**

```ts
it('ERROS tem os status da spec', () => { expect(ERROS.EVENTO_INATIVO.status).toBe(503); expect(ERROS.RECUSADA.status).toBe(422); expect(ERROS.TEMPO_ESGOTADO.status).toBe(504); expect(ERROS.TETO_DIARIO.mensagem).toBe('A pintora foi descansar. Volte amanhã!') })
it('GET /api/estilos lista ativos sem expor o prompt', async () => {
  const r = await app.inject('/api/estilos')
  expect(r.json()).toEqual([{ id: 'noite-estrelada', nome: 'Noite Estrelada', artista: 'Vincent van Gogh', miniaturaUrl: '/api/estilos/noite-estrelada/miniatura' }, /* … 3 outros */])
})
it('GET miniatura devolve JPEG; estilo inexistente dá 404 ESTILO_INVALIDO', async () => { /* content-type image/jpeg; 404 { erro: 'ESTILO_INVALIDO' } */ })
it('GET /api/saude', async () => { expect((await app.inject('/api/saude')).json()).toEqual({ ok: true, eventoAtivo: true, pinturasHoje: 0, tetoDiario: 1000, fila: 0 }) })
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `npm --prefix servidor test` — Expected: FAIL.

- [ ] **Step 3: Implementar** `erros.ts`, `app.ts` (registra `@fastify/multipart` com `limits: { fileSize: 5 * 1024 * 1024, files: 1 }`, error handler, rotas), `rotas/estilos.ts` (miniatura com `cache-control: public, max-age=3600`), `rotas/saude.ts`, e `index.ts` (lê config, carrega catálogo avisando no log, cria acervo, `criarTetoDiario({ contagemInicial: await acervo.contarHoje(), hoje: () => dataLocal(new Date()) })`, escuta `0.0.0.0:<porta>`). `criarAppDeTeste` usa os estilos reais, acervo em pasta temporária, provedor falso e `eventoAtivo: true`; o provedor (padrão ou de `sobrescritas`) é sempre embrulhado com `comNovaTentativa`, como em produção.

- [ ] **Step 4: Rodar e ver passar.** Run: `npm --prefix servidor test` — Expected: PASS. Run também: `npm --prefix servidor run dev` e `curl http://localhost:3000/api/saude` → JSON com `"ok":true`.

- [ ] **Step 5: Commit.** `git commit -m "feat(servidor): app, erros e rotas de estilos e saúde"`

---

### Task 8: Rota `POST /api/pintar`

**Files:**
- Create: `servidor/src/rotas/pintar.ts`
- Modify: `servidor/src/app.ts` (registrar a rota)
- Test: `servidor/test/pintar.test.ts`

**Interfaces:**
- Consumes: tudo da Task 7, `prepararFoto`, `paraJpeg`, `ErroFotoInvalida`, `ErroRecusa`, `ErroTemporario`.
- Produces: `POST /api/pintar` → 200 `image/jpeg` + `X-Codigo-Obra` (ausente se a gravação falhar), ou erro `{ erro, mensagem }`.

Ordem (Decisão 1): interruptor → aceite (`termosVersao` não vazio e `aceiteEm` data ISO válida) → estilo → `prepararFoto` → `limitadorAparelho.tentar(X-Aparelho ?? ip)` → `limitadorIp.tentar(ip)` → `teto.reservar()` → corrida entre `fila.executar(() => provedor.pintar(...))` e `tempoMaximoMs` → `paraJpeg` → `acervo.gravar` → `teto.confirmar()`. Qualquer falha depois de reservar → `teto.liberar()`. Resposta tardia após o tempo esgotado é descartada (sem gravar, sem confirmar).

- [ ] **Step 1: Escrever os testes** (todos com `criarAppDeTeste` e `montarFormulario`):

```ts
it('sucesso: devolve JPEG, código e grava o acervo sem IP', async () => {
  const r = await pintar({ estiloId: 'girassois' })
  expect(r.statusCode).toBe(200); expect(r.headers['content-type']).toBe('image/jpeg')
  const codigo = r.headers['x-codigo-obra'] as string; expect(codigo).toMatch(/^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/)
  const info = await lerInfo(acervoDir, codigo)
  expect(info).toMatchObject({ estiloId: 'girassois', estiloNome: 'Girassóis', provedor: 'falso', termosVersao: 'v1' }); expect(info).not.toHaveProperty('ip')
})
it('evento desligado → 503 EVENTO_INATIVO sem chamar a IA', async () => { /* eventoAtivo: false; espião em pintar não chamado */ })
it('sem aceite → 400 ACEITE_AUSENTE', async () => { /* sem termosVersao */ })
it('estilo inexistente → 400 ESTILO_INVALIDO', async () => { /* … */ })
it('foto que não é imagem → 400 FOTO_INVALIDA', async () => { /* … */ })
it('foto de 6 MB → 400 FOTO_INVALIDA', async () => { /* … */ })
it('pedido inválido não consome o limite do aparelho', async () => { /* limiteAparelho.max 1: inválido, depois válido → 200 */ })
it('limite por aparelho → 429 LIMITE_APARELHO; outro aparelho passa', async () => { /* max 2 */ })
it('limite de IP usa o IP real vindo do proxy', async () => {
  // limiteIp.max 1, cada pedido com X-Aparelho diferente
  expect((await pintar({}, { 'x-forwarded-for': '1.1.1.1' })).statusCode).toBe(200)
  expect((await pintar({}, { 'x-forwarded-for': '2.2.2.2' })).statusCode).toBe(200)
  expect((await pintar({}, { 'x-forwarded-for': '1.1.1.1' })).json().erro).toBe('LIMITE_IP')
})
it('teto diário → 429 TETO_DIARIO', async () => { /* tetoDiario 1: segundo pedido barrado */ })
it('falha da IA devolve a vaga do teto', async () => { /* teto 1: IA falha, depois sucesso → 200 */ })
it('recusa → 422 RECUSADA, uma chamada, nada no acervo', async () => { /* … */ })
it('temporário duas vezes → 502 IA_INDISPONIVEL', async () => { /* 2 chamadas */ })
it('tempo esgotado → 504 e resposta tardia não é gravada', async () => {
  // tempoMaximoMs 50, provedor responde em 200 ms
  expect((await pintar({})).json().erro).toBe('TEMPO_ESGOTADO')
  await esperar(300)
  expect(await contarObras(acervoDir)).toBe(0); expect(deps.teto.gravadasHoje()).toBe(0)
})
it('falha ao gravar o acervo ainda entrega a pintura', async () => { /* acervo.gravar rejeita → 200 image/jpeg, sem x-codigo-obra */ })
it('saída PNG da IA vira JPEG', async () => { /* provedor devolve PNG → content-type image/jpeg e formato jpeg */ })
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `npm --prefix servidor test` — Expected: FAIL.

- [ ] **Step 3: Implementar `servidor/src/rotas/pintar.ts`** conforme a ordem acima. Cada pedido gera uma linha de log `info` com `{ resultado: 'ok' | <CodigoErro>, estiloId, codigo, duracaoMs, gravadasHoje }` — sem IP. (`pintar`, `lerInfo`, `contarObras` e `esperar` dos testes são ajudantes locais do arquivo de teste.)

- [ ] **Step 4: Rodar e ver passar.** Run: `npm --prefix servidor test` — Expected: PASS (todos os testes do servidor).

- [ ] **Step 5: Commit.** `git commit -m "feat(servidor): rota de pintura com proteções e acervo"`

---

### Task 9: Site base, aceite, armazenamento e cliente da API

**Files:**
- Create: `site/package.json`, `site/tsconfig.json`, `site/vite.config.ts`, `site/vitest.config.ts`, `site/index.html`, `site/termos.html`, `site/src/main.ts` (só monta `#app`), `site/src/config.ts`, `site/src/armazenamento.ts`, `site/src/aceite.ts`, `site/src/api.ts`
- Test: `site/test/aceite.test.ts`, `site/test/api.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // config.ts — valores a preencher pelo usuário ficam como 'PREENCHER'
  export const CONFIG: { escola: string; emailContato: string; assinatura: string; termosVersao: 'v1' }
  // armazenamento.ts — try/catch em toda leitura/escrita; falhou → Map em memória
  export function ler(chave: string): string | null
  export function gravar(chave: string, valor: string): void
  // aceite.ts
  export interface Aceite { termosVersao: string; aceiteEm: string }
  export function registrarAceite(agora?: Date): Aceite   // usa CONFIG.termosVersao
  export function lerAceite(): Aceite | null             // null se a versão gravada ≠ CONFIG.termosVersao
  export function obterIdAparelho(): string              // crypto.randomUUID(), persistido
  // api.ts
  export interface EstiloPublico { id: string; nome: string; artista: string; miniaturaUrl: string }
  export interface ResultadoPintura { imagem: Blob; codigo: string | null }
  export class ErroPintura extends Error { constructor(public readonly codigo: string, mensagem: string) }
  export function buscarEstilos(): Promise<EstiloPublico[]>
  export function buscarSaude(): Promise<{ eventoAtivo: boolean }>
  export function pintar(d: { foto: Blob; estiloId: string; aceite: Aceite; idAparelho: string }, o?: { tempoEnvioMs?: number; tempoTotalMs?: number }): Promise<ResultadoPintura>
  export function interpretarErro(status: number, corpo: string): ErroPintura
  ```
  `pintar` usa `XMLHttpRequest` (para medir o fim do envio): envio não concluído em 30 s ou resposta não concluída em 100 s → `ErroPintura('TEMPO_ESGOTADO', 'Demorou mais que o normal. Tente de novo.')`; erro de rede → `ErroPintura('SEM_INTERNET', 'Parece que a internet caiu. Tente de novo.')`. Campos do formulário antes do arquivo: `estiloId`, `termosVersao`, `aceiteEm`, depois `foto` (`foto.jpg`).

- [ ] **Step 1: Esqueleto.** Vite multi-página (`index.html`, `termos.html`), proxy `/api` → `http://localhost:3000`; Vitest em modo navegador (Playwright, Chromium), conforme a documentação atual; scripts `dev`, `build`, `test` (vitest), `e2e` (playwright).

- [ ] **Step 2: Escrever os testes:**

```ts
it('registra e lê o aceite da versão atual', () => { const a = registrarAceite(new Date('2026-11-20T15:00:00Z')); expect(a).toEqual({ termosVersao: 'v1', aceiteEm: '2026-11-20T15:00:00.000Z' }); expect(lerAceite()).toEqual(a) })
it('ignora aceite de versão antiga', () => { localStorage.setItem('aceite', JSON.stringify({ termosVersao: 'v0', aceiteEm: '…' })); expect(lerAceite()).toBeNull() })
it('idAparelho é estável', () => { expect(obterIdAparelho()).toBe(obterIdAparelho()) })
it('sem localStorage, aceite e id continuam funcionando em memória', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('bloqueado', 'SecurityError') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('bloqueado', 'SecurityError') })
  const a = registrarAceite(); expect(lerAceite()).toEqual(a); expect(obterIdAparelho()).toBe(obterIdAparelho())
})
it('interpretarErro usa o JSON do servidor', () => { const e = interpretarErro(429, '{"erro":"LIMITE_APARELHO","mensagem":"Calma, artista! Espere alguns minutinhos para pintar de novo."}'); expect(e.codigo).toBe('LIMITE_APARELHO'); expect(e.message).toBe('Calma, artista! Espere alguns minutinhos para pintar de novo.') })
it('interpretarErro com corpo estranho cai em IA_INDISPONIVEL', () => { expect(interpretarErro(502, '<html>').message).toBe('A pintora está com dificuldades. Tente de novo.') })
```

- [ ] **Step 3: Rodar e ver falhar**, **Step 4: implementar**, **Step 5: rodar e ver passar.** Run: `npm --prefix site test`.

- [ ] **Step 6: Commit.** `git commit -m "feat(site): base, aceite e cliente da API"`

---

### Task 10: Preparo da foto e moldura (site)

**Files:**
- Create: `site/src/foto.ts`, `site/src/moldura.ts`, `site/test/fixtures/gerar.mjs` (+ fixtures geradas, versionadas)
- Test: `site/test/foto.test.ts`, `site/test/moldura.test.ts`

**Interfaces:**
- Consumes: `ErroPintura`.
- Produces:
  ```ts
  export function calcularDimensoes(largura: number, altura: number, max?: number): { largura: number; altura: number }   // max 1600
  export function prepararFoto(arquivo: Blob): Promise<Blob>              // JPEG 0,85; falha → ErroPintura('FOTO_INVALIDA', 'Não consegui abrir essa foto. Tente tirar outra.')
  export function comporMoldura(pintura: Blob, assinatura: string): Promise<Blob>   // JPEG 0,9
  ```
  Geometria da moldura (sobre a pintura de largura `w`, altura `h`, `m = min(w, h)`): borda `b = round(0.08·m)` nos 4 lados; com assinatura, faixa extra inferior `p = round(0.12·m)` com a assinatura centralizada numa plaqueta. Saída: `(w + 2b) × (h + 2b + p)`; sem assinatura `p = 0`. Visual de moldura dourada de museu (gradientes, filete interno) a critério do implementador.

- [ ] **Step 1: Gerador de fixtures** (`node site/test/fixtures/gerar.mjs`, usa `sharp` como devDependency do site): `paisagem-4000x3000.jpg`, `retrato-orientacao-6.jpg` (400×300 armazenado, `orientation: 6`), `pintura-800x600.png` (cor sólida `#3366cc`), `selfie.jpg` (1200×1600 colorida, para o e2e).

- [ ] **Step 2: Escrever os testes** (fixtures carregadas com `import url from './fixtures/x.jpg?url'` + `fetch`; `pixel(bitmap, x, y)` lê RGB via canvas e `toBeCloseToCor(rgb, tolerância)` é um matcher local — ambos em `site/test/ajudantes.ts`):

```ts
it('calcularDimensoes', () => { expect(calcularDimensoes(4000, 3000)).toEqual({ largura: 1600, altura: 1200 }); expect(calcularDimensoes(3000, 4000)).toEqual({ largura: 1200, altura: 1600 }); expect(calcularDimensoes(1000, 800)).toEqual({ largura: 1000, altura: 800 }) })
it('prepararFoto reduz e gera JPEG', async () => { const b = await prepararFoto(paisagem); expect(b.type).toBe('image/jpeg'); const i = await createImageBitmap(b); expect([i.width, i.height]).toEqual([1600, 1200]) })
it('prepararFoto aplica a rotação EXIF', async () => { const i = await createImageBitmap(await prepararFoto(retrato6)); expect([i.width, i.height]).toEqual([300, 400]) })
it('prepararFoto recusa o que não é imagem', async () => { await expect(prepararFoto(new Blob(['texto']))).rejects.toMatchObject({ codigo: 'FOTO_INVALIDA' }) })
it('moldura com assinatura: dimensões e centro preservado', async () => {
  const i = await createImageBitmap(await comporMoldura(pintura800x600, '@escola'))
  expect([i.width, i.height]).toEqual([896, 768])
  expect(pixel(i, 448, 48 + 300)).toBeCloseToCor([51, 102, 204], 10)
})
it('moldura sem assinatura não tem plaqueta', async () => { const i = await createImageBitmap(await comporMoldura(pintura800x600, '')); expect([i.width, i.height]).toEqual([896, 696]) })
```

- [ ] **Step 3: Rodar e ver falhar**, **Step 4: implementar** (`createImageBitmap(arquivo, { imageOrientation: 'from-image' })` + `OffscreenCanvas`/canvas → `toBlob('image/jpeg', 0.85)`), **Step 5: rodar e ver passar.** Run: `npm --prefix site test`.

- [ ] **Step 6: Commit.** `git commit -m "feat(site): preparo da foto e moldura"`

---

### Task 11: Telas de início, termos, quadros e foto (+ infraestrutura e2e)

**Files:**
- Create: `site/playwright.config.ts`, `site/e2e/inicio.spec.ts`
- Create: `site/src/telas/{inicio.ts,quadros.ts,foto.ts}`, `site/src/estilos.css`
- Modify: `site/src/main.ts`, `site/termos.html`

**Interfaces:**
- Consumes: `CONFIG`, `registrarAceite`, `lerAceite`, `buscarEstilos`, `buscarSaude`, `EstiloPublico`.
- Produces (usados pela Task 12): estado compartilhado em `main.ts`:
  ```ts
  export interface Estado { estilo?: EstiloPublico; foto?: Blob; resultado?: ResultadoPintura; comMoldura?: Blob }
  export function irPara(tela: 'inicio' | 'quadros' | 'foto' | 'revelacao' | 'resultado' | 'erro', dados?: { erro?: ErroPintura }): void
  ```
  `data-testid`: `botao-criar`, `link-termos`, `aviso-evento-inativo`, `cartao-estilo` (com `data-estilo-id`), `botao-tirar-foto`, `input-foto`.
  Textos: título "Vire uma pintura de Van Gogh"; resumo "Tire uma foto e veja ela virar uma pintura de Van Gogh. Ao continuar, você declara ter 18 anos ou mais e autoriza a escola a guardar sua foto e a pintura e usá-las em eventos futuros."; link "Ler os termos de uso de imagem"; botão "Quero criar minha foto"; quadros "Escolha o seu quadro"; foto "Tirar foto"; evento inativo "Esta experiência está disponível no estande.".

- [ ] **Step 1: Configurar o Playwright.** Projetos `iphone` (`devices['iPhone 13']`, WebKit) e `android` (`devices['Pixel 7']`, Chromium). `webServer`: (1) `npm --prefix ../servidor run dev` com `PROVEDOR=falso`, `EVENTO_ATIVO=true`, `ACERVO_DIR=<site/e2e/.acervo>`, `ESTILOS_DIR=../estilos`, aguardando `http://localhost:3000/api/saude`; (2) `npm run dev -- --port 5173`. `globalSetup` apaga `e2e/.acervo`. Instalar navegadores: `npx playwright install chromium webkit`.

- [ ] **Step 2: Escrever os testes e2e:**

```ts
test('início mostra o resumo e abre os termos', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Vire uma pintura de Van Gogh' })).toBeVisible()
  await expect(page.getByText('18 anos ou mais')).toBeVisible()
  await page.getByTestId('link-termos').click(); await expect(page).toHaveURL(/\/termos/)
  await expect(page.getByRole('heading', { name: 'Termos de uso de imagem' })).toBeVisible(); await expect(page.getByText(/exclusão/)).toBeVisible()
})
test('aceite grava v1 e leva aos 4 quadros em ordem', async ({ page }) => {
  await page.goto('/'); await page.getByTestId('botao-criar').click()
  await expect(page.getByTestId('cartao-estilo')).toHaveCount(4); await expect(page.getByTestId('cartao-estilo').first()).toContainText('Noite Estrelada')
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('aceite')!)).termosVersao).toBe('v1')
})
test('escolher um quadro abre a tela da câmera nativa', async ({ page }) => {
  /* … clicar cartão girassois */ const input = page.getByTestId('input-foto')
  await expect(input).toHaveAttribute('capture', 'user'); await expect(input).toHaveAttribute('accept', 'image/*')
})
test('evento desligado mostra o aviso e esconde o botão', async ({ page }) => {
  await page.route('**/api/saude', r => r.fulfill({ json: { ok: true, eventoAtivo: false, pinturasHoje: 0, tetoDiario: 1000, fila: 0 } }))
  await page.goto('/'); await expect(page.getByTestId('aviso-evento-inativo')).toHaveText('Esta experiência está disponível no estande.'); await expect(page.getByTestId('botao-criar')).toBeHidden()
})
```

- [ ] **Step 3: Rodar e ver falhar.** Run: `npm --prefix site run e2e -- inicio` — Expected: FAIL.

- [ ] **Step 4: Implementar as telas e `termos.html`.** Termos (versão `v1`, preenchidos com `CONFIG.escola` e `CONFIG.emailContato`) cobrindo exatamente os itens da spec 6.2: quem guarda; o que é guardado (foto real e pintura); finalidade (eventos e divulgação da escola); processamento por provedor de IA externo; prazo de até 5 anos; declaração de maioridade; pedido de exclusão por e-mail com o código da obra. Botão "Tirar foto" aciona o `<input type="file" accept="image/*" capture="user" hidden>`. Visual mobile-first; se houver skill de design de frontend disponível, usá-la para a direção visual.

- [ ] **Step 5: Rodar e ver passar.** Run: `npm --prefix site run e2e -- inicio` — Expected: PASS nos dois projetos.

- [ ] **Step 6: Commit.** `git commit -m "feat(site): telas de início, termos, quadros e foto"`

---

### Task 12: Revelação, resultado, erros e compartilhamento

**Files:**
- Create: `site/src/telas/{revelacao.ts,resultado.ts,erro.ts}`, `site/src/compartilhar.ts`, `site/e2e/pintura.spec.ts`
- Test: `site/test/compartilhar.test.ts`

**Interfaces:**
- Consumes: `Estado`, `irPara`, `prepararFoto`, `pintar`, `comporMoldura`, `obterIdAparelho`, `lerAceite`, `CONFIG.assinatura`.
- Produces:
  ```ts
  export function ehIOS(ua: string, maxTouchPoints: number): boolean   // iPhone/iPad, inclusive iPadOS com UA de Mac
  export function compartilhar(imagem: Blob, nomeArquivo: string): Promise<'compartilhado' | 'cancelado' | 'indisponivel'>
  export function salvar(imagem: Blob, nomeArquivo: string): void      // iOS: sobreposição com a imagem e "Toque e segure a imagem para salvar"; demais: <a download>
  ```
  `data-testid`: `tela-revelacao`, `imagem-resultado`, `opcao-com-moldura`, `opcao-so-pintura`, `botao-compartilhar`, `botao-salvar`, `codigo-obra`, `botao-pintar-de-novo`, `tela-erro`, `mensagem-erro`, `botao-tentar-de-novo`, `botao-outra-foto`, `aviso-evento-inativo`.
  Arquivos: `pintura-moldura-<código>.jpg` e `pintura-<código>.jpg` (sem código: `pintura-moldura.jpg` / `pintura.jpg`).
  Frases da revelação, alternando: "Misturando os amarelos…", "Pintando o céu em espirais…", "Engrossando as pinceladas…", "Secando a tinta…". Duração mínima 4 s (Decisão 6). Resultado abre em "Com moldura" (Decisão 7); `codigo-obra` mostra "Código da obra: <código>" e some sem código.
  Ações por erro: `EVENTO_INATIVO` → aviso, sem botão; `FOTO_INVALIDA` e `RECUSADA` → `botao-outra-foto` (volta à tela de foto); `ESTILO_INVALIDO` → volta aos quadros; `ACEITE_AUSENTE` → volta ao início; demais → `botao-tentar-de-novo` reenviando `estado.foto`. Botões de envio ficam desabilitados enquanto há pedido em andamento.

- [ ] **Step 1: Escrever os testes:**

```ts
// compartilhar.test.ts
it('ehIOS', () => { expect(ehIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true); expect(ehIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true); expect(ehIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false); expect(ehIOS('Mozilla/5.0 (Linux; Android 14; Pixel 7)', 5)).toBe(false) })
it('compartilhar sem suporte a arquivos devolve indisponivel', async () => { vi.stubGlobal('navigator', { ...navigator, canShare: () => false }); expect(await compartilhar(blob, 'a.jpg')).toBe('indisponivel') })
// pintura.spec.ts
test('fluxo completo grava o acervo', async ({ page }) => {
  await aceitarEEscolher(page, 'girassois'); const inicio = Date.now()
  await page.getByTestId('input-foto').setInputFiles('test/fixtures/selfie.jpg')
  await expect(page.getByTestId('tela-revelacao')).toBeVisible(); await expect(page.getByTestId('imagem-resultado')).toBeVisible({ timeout: 20_000 })
  expect(Date.now() - inicio).toBeGreaterThanOrEqual(4000)
  const codigo = (await page.getByTestId('codigo-obra').textContent())!.replace('Código da obra: ', '')
  expect(codigo).toMatch(/^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/)
  const info = lerInfoDoAcervo('e2e/.acervo', codigo); expect(info).toMatchObject({ estiloId: 'girassois', termosVersao: 'v1' })
})
test('alternar para "Só a pintura" troca a imagem', async ({ page }) => { /* src muda e a imagem fica menor que a com moldura */ })
test('compartilhar envia o arquivo com moldura', async ({ page }) => {
  await page.addInitScript(() => { (window as any).__arquivos = []; navigator.canShare = () => true; navigator.share = async (d: any) => { (window as any).__arquivos.push(...d.files.map((f: File) => f.name)) } })
  /* … fluxo, clicar botao-compartilhar */ expect(await page.evaluate(() => (window as any).__arquivos)).toEqual([`pintura-moldura-${codigo}.jpg`])
})
test('salvar no Android baixa o arquivo', async ({ page }, info) => { test.skip(info.project.name !== 'android'); /* waitForEvent('download') → suggestedFilename() === `pintura-moldura-${codigo}.jpg` */ })
test('salvar no iPhone mostra a dica', async ({ page }, info) => { test.skip(info.project.name !== 'iphone'); /* texto "Toque e segure a imagem para salvar" */ })
test('pintar de novo volta aos quadros', async ({ page }) => { /* após o resultado, clicar botao-pintar-de-novo */ await expect(page.getByTestId('cartao-estilo')).toHaveCount(4) })
test('erro de limite: tentar de novo reenvia a mesma foto', async ({ page }) => {
  const tamanhos: number[] = []; let n = 0
  await page.route('**/api/pintar', async r => { tamanhos.push(r.request().postDataBuffer()!.length); if (n++ === 0) return r.fulfill({ status: 429, json: { erro: 'LIMITE_APARELHO', mensagem: 'Calma, artista! Espere alguns minutinhos para pintar de novo.' } }); return r.continue() })
  /* … */ await expect(page.getByTestId('mensagem-erro')).toHaveText('Calma, artista! Espere alguns minutinhos para pintar de novo.')
  await page.getByTestId('botao-tentar-de-novo').click(); await expect(page.getByTestId('imagem-resultado')).toBeVisible({ timeout: 20_000 })
  expect(tamanhos).toHaveLength(2); expect(tamanhos[1]).toBe(tamanhos[0])
})
test('toque duplo em tentar de novo envia um só pedido', async ({ page }) => { /* primeiro 502, depois dblclick em botao-tentar-de-novo → total de 2 pedidos */ })
test('recusa oferece tirar outra foto', async ({ page }) => { /* 422 RECUSADA → botao-outra-foto → botao-tirar-foto visível */ })
test('internet caiu', async ({ page }) => { /* route.abort('internetdisconnected') → "Parece que a internet caiu. Tente de novo." */ })
test('evento desligado durante o uso', async ({ page }) => { /* 503 EVENTO_INATIVO → aviso-evento-inativo, sem botao-tentar-de-novo */ })
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `npm --prefix site test` e `npm --prefix site run e2e -- pintura` — Expected: FAIL.

- [ ] **Step 3: Implementar** (ajudantes de e2e `aceitarEEscolher` e `lerInfoDoAcervo` em `site/e2e/ajudantes.ts`) as telas, `compartilhar.ts` e a animação de pinceladas da revelação (CSS/canvas sobre a foto; revelação final com pinceladas varrendo a tela).

- [ ] **Step 4: Rodar e ver passar.** Run: `npm --prefix site test` e `npm --prefix site run e2e` — Expected: PASS em todos os testes, nos dois projetos.

- [ ] **Step 5: Commit.** `git commit -m "feat(site): revelação, resultado, erros e compartilhamento"`

---

### Task 13: Deploy (Docker Compose + Caddy)

**Files:**
- Create: `deploy/{docker-compose.yml,Caddyfile,pintor.Dockerfile,caddy.Dockerfile,.env.exemplo}`

**Interfaces:**
- Consumes: `npm run build` e `npm start` do servidor; `npm run build` do site (gera `site/dist`).
- Produces: `docker compose -f deploy/docker-compose.yml up -d --build` sobe tudo; `.env` (cópia de `.env.exemplo`) com `DOMINIO`, `PROVEDOR`, chave do provedor e as variáveis da Task 2.

- [ ] **Step 1: Escrever os arquivos.**
  - `pintor.Dockerfile`: multi-stage Node 22 (build com `tsc`; imagem final só com `dist`, `node_modules` de produção), usuário `node`, `ESTILOS_DIR=/app/estilos`, `ACERVO_DIR=/dados/acervo`, `PORTA=3000`. **Sem** `ports` publicados no compose.
  - `caddy.Dockerfile`: estágio Node que roda `npm ci && npm run build` em `site/`, imagem final `caddy:2` com `site/dist` em `/srv/site` e o `Caddyfile`.
  - `Caddyfile`:
    ```
    {$DOMINIO} {
      encode gzip
      handle /api/* {
        request_body { max_size 6MB }
        reverse_proxy pintor:3000
      }
      handle {
        root * /srv/site
        try_files {path} {path}.html /index.html
        file_server
      }
    }
    ```
  - `docker-compose.yml`: serviços `pintor` (volumes `../estilos:/app/estilos:ro` e `../dados/acervo:/dados/acervo`, `env_file: .env`, `restart: unless-stopped`) e `caddy` (portas 80/443, volumes nomeados para `/data` e `/config`, **sem** volume do acervo).
  - `.env.exemplo` com todas as variáveis e comentários em português; `EVENTO_ATIVO=false`.

- [ ] **Step 2: Validar.** Run: `docker compose -f deploy/docker-compose.yml --env-file deploy/.env.exemplo config` — Expected: sem erros, e a saída do serviço `caddy` não contém `acervo`. Se o Docker não estiver disponível nesta máquina, fazer a validação na VPS na Task 15.

- [ ] **Step 3: Subir localmente (se houver Docker).** `DOMINIO=localhost`, `EVENTO_ATIVO=true`, `PROVEDOR=falso`; Run: `curl -k https://localhost/api/saude` — Expected: `"ok":true`; abrir `https://localhost` e fazer uma pintura completa.

- [ ] **Step 4: Commit.** `git commit -m "feat(deploy): docker compose com caddy e pintor"`

---

### Task 14: Operação do evento (backup, QR code, checklist)

**Files:**
- Create: `scripts/package.json`, `scripts/backup-acervo.sh`, `scripts/gerar-qrcode.mjs`, `docs/checklist-evento.md`

**Interfaces:**
- Produces:
  - `scripts/backup-acervo.sh [pasta-do-projeto]` → `dados/backups/acervo-AAAA-MM-DD.zip` (data via `TZ=America/Sao_Paulo date +%F`); sem `zip` instalado, sai com "Instale o zip: sudo apt install zip".
  - `node scripts/gerar-qrcode.mjs <url>` → `qrcode.svg` e `qrcode.png` (2000 px, margem 4, correção de erro `H`), usando o pacote `qrcode`.

- [ ] **Step 1: Implementar os dois scripts.**

- [ ] **Step 2: Verificar o backup.** Num Linux (VPS ou WSL), com um acervo de teste de 2 obras: Run: `bash scripts/backup-acervo.sh . && unzip -l dados/backups/acervo-*.zip` — Expected: lista os 6 arquivos das 2 obras.

- [ ] **Step 3: Verificar o QR.** Run: `node scripts/gerar-qrcode.mjs https://example.com` — Expected: os dois arquivos criados; lido com a câmera de um celular abre `https://example.com`.

- [ ] **Step 4: Escrever `docs/checklist-evento.md`** com os itens da spec seção 9 e o lembrete de ativar snapshots da VPS (spec 6.4), mais: conferir que `site/src/config.ts` não tem mais `PREENCHER` (`grep -n PREENCHER site/src/config.ts` sem saída) e que os termos foram revisados pela escola; como achar e excluir uma obra pelo código (`ls -d dados/acervo/*/<código>` e `rm -r` da pasta).

- [ ] **Step 5: Commit.** `git commit -m "feat(ops): backup do acervo, QR code e checklist do evento"`

---

### Task 15: Publicação na VPS e validação em campo (com o usuário)

Sem código novo; precisa dos insumos da spec seção 12.

**Files:**
- Create: `docs/validacao-campo.md` (resultados)
- Modify: `site/src/config.ts` (valores reais)

- [ ] **Step 1: Preencher `site/src/config.ts`** com escola, e-mail e assinatura fornecidos pelo usuário; commit.

- [ ] **Step 2: Publicar na VPS** (com o usuário, via SSH): apontar o subdomínio, clonar o repositório, `cp deploy/.env.exemplo deploy/.env` e preencher, `mkdir -p dados/acervo && sudo chown 1000:1000 dados/acervo`, `docker compose -f deploy/docker-compose.yml up -d --build`. Se as portas 80/443 já estiverem em uso, trocar o Caddy por um bloco no servidor existente com o mesmo roteamento. Verificar: `curl https://<subdominio>/api/saude` → `"ok":true`.

- [ ] **Step 3: Testes em celulares reais** com `EVENTO_ATIVO=true` e o provedor real: iPhone (Safari), Android (Chrome), QR lido pela câmera nativa, pelo Instagram e pelo WhatsApp, um celular antigo, internet lenta (modo 3G ou rede ruim). Registrar em `docs/validacao-campo.md`: aparelho, navegador, tempo da pintura, problemas.

- [ ] **Step 4: Ensaio geral** na semana do evento: 20 a 30 pessoas ao mesmo tempo. Conferir no log a fila, os limites e a contagem do dia; conferir o backup baixado. Registrar em `docs/validacao-campo.md` e corrigir o que aparecer.

- [ ] **Step 5: Desligar o interruptor** (`EVENTO_ATIVO=false`, `docker compose restart pintor`) até o dia do evento; commit de `docs/validacao-campo.md`.
