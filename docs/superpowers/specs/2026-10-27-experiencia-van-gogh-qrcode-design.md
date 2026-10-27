# Experiência "Vire uma obra de arte" por QR code — Design

**Data:** 2026-10-27
**Status:** aguardando revisão
**Prazo:** evento em 2 a 4 semanas a partir desta data

## 1. Objetivo

Proporcionar aos visitantes do estande um **efeito uau** e uma **foto que eles queiram compartilhar**: o visitante lê um QR code, abre um site no próprio celular (sem instalar nada), escolhe um estilo de arte, tira uma foto e vê essa foto ser "revelada" como uma obra no estilo escolhido.

Objetivo secundário: formar um **acervo** (foto real + pintura) guardado no servidor para a escola usar em eventos futuros.

**Critérios de sucesso**

- Um visitante adulto, com um celular comum (iPhone ou Android), vai do QR code à pintura pronta sem ajuda.
- A obra é reconhecível no estilo escolhido (quem olha diz "isso é cubismo", "isso é Van Gogh") e a pessoa continua reconhecível nela.
- A experiência funciona mesmo com vários visitantes ao mesmo tempo e internet instável, falhando de forma amigável quando não houver conexão.
- Toda obra pintada fica guardada no acervo com o registro do aceite dos termos.

**Público:** majoritariamente adultos (pais, professores, visitantes). Volume esperado: 300 a 2.000 usos no evento.

## 2. Fora de escopo

- Câmera ao vivo dentro do site (preview, filtro em tempo real, troca de câmera, contagem regressiva).
- Escolher foto da galeria do celular.
- Painel web do acervo (o acesso é por pastas no servidor).
- Captação de contatos (e-mail, WhatsApp, Instagram).
- Telão no estande, outros idiomas além do português.

## 3. Experiência do visitante

Interface toda em português, pensada para celular.

1. **Tela inicial (aceite)** — aberta direto pelo QR code.
   - Título convidativo ("Vire uma obra de arte").
   - Resumo curto, por exemplo: *"Tire uma foto e veja ela virar uma obra de arte. Ao continuar, você declara ter 18 anos ou mais e autoriza a escola a guardar sua foto e a pintura e usá-las em eventos futuros."*
   - Link **"Ler os termos de uso de imagem"** para a página `/termos` (leitura opcional).
   - Botão **"Quero criar minha foto"**: clicar nele é o aceite. O site guarda localmente o momento do aceite e a versão dos termos.
2. **Escolha do estilo** — título "Escolha o estilo da sua obra"; cartões com miniatura, nome e legenda (a obra ou o artista que representa o estilo), montados a partir do módulo de estilos (seção 5). Inicialmente 6, nesta ordem:

   | Nome | Legenda | Como a foto fica |
   |---|---|---|
   | Arte Grega | Estátua de mármore | Busto de mármore branco, como as esculturas do período clássico |
   | Renascimento | Botticelli | Têmpera no estilo de *O Nascimento de Vênus* |
   | Cubismo | Picasso | Rosto e corpo em planos geométricos, vistos de vários ângulos |
   | Expressionismo | Munch · O Grito | Céu laranja ondulado e linhas curvas |
   | Van Gogh | A Noite Estrelada | Pinceladas grossas e céu em espirais |
   | Mona Lisa | Leonardo da Vinci | Retrato a óleo com sfumato e paisagem ao fundo |

3. **Foto** — botão **"Tirar foto"** que abre a **câmera nativa** do celular (`<input type="file" accept="image/*" capture="user">`, frontal sugerida). Não há câmera ao vivo no site. Limitação conhecida: alguns navegadores embutidos (Instagram, WhatsApp) podem ignorar `capture` e oferecer a galeria; isso é aceito.
4. **Revelação** (5 a 20 s) — a foto aparece e vai sendo "pintada" com animação de pinceladas e frases alternadas, próprias do estilo escolhido (em Van Gogh, "Misturando os amarelos…"; na Arte Grega, "Esculpindo os cachos…"). Quando a pintura chega, ela é revelada com pinceladas varrendo a tela.
5. **Resultado**
   - Chave **Com moldura / Só a pintura**. A versão com moldura é composta no celular: moldura dourada de museu + texto de assinatura configurável (ex.: @perfil ou #hashtag).
   - **Compartilhar**: menu nativo do celular (Web Share API com arquivo). Sem suporte, cai para **Salvar**.
   - **Salvar**: baixa a imagem; no iOS, se o download não for possível, abre a imagem com a dica "toque e segure para salvar".
   - **Código da obra** exibido discretamente (ex.: `K7M-3PX`), para pedidos de exclusão.
   - **Pintar de novo**: volta à escolha do estilo (o aceite continua válido).
6. **Erros** — mensagem amigável com **Tentar de novo**, que reenvia a mesma foto guardada em memória, sem precisar tirar outra. Mensagens por tipo de erro na seção 7.

## 4. Arquitetura

```
Celular do visitante ──HTTPS──▶  VPS do usuário (Docker Compose)
 (site estático)                  caddy  (HTTPS automático, Let's Encrypt)
                                   ├─ /          → arquivos do site (build do Vite)
                                   ├─ /termos    → página de termos
                                   └─ /api/*     → serviço "pintor" (Node.js)
                                                      ├─ módulo de estilos  ← pasta estilos/
                                                      ├─ acervo            → pasta dados/acervo/
                                                      └─ adaptador provedor ──▶ API de IA generativa
```

### 4.1 Site (frontend)

- Vite + TypeScript, sem framework (5 telas simples).
- Responsabilidades:
  - fluxo de telas;
  - preparar a foto: aplicar a rotação correta (orientação EXIF), redimensionar para no máximo **1600 px** no lado maior e reencodar como **JPEG qualidade 0,85** (cerca de 300 a 500 KB). O reencode também remove metadados como localização GPS;
  - chamar a API e mostrar a revelação;
  - compor a versão com moldura (canvas: pintura + PNG da moldura + texto de assinatura);
  - compartilhar e salvar.
- Identificador do aparelho: UUID aleatório gerado no aceite, guardado no `localStorage` e enviado no cabeçalho `X-Aparelho`. Serve só para limitar uso (seção 6).
- Configuração do site (arquivo de config no build): texto da assinatura, nome da escola, versão atual dos termos.

### 4.2 Serviço "pintor" (backend)

- Node.js 22 LTS + TypeScript, Fastify, `@fastify/multipart`, `sharp` para validar e reencodar imagens.
- As credenciais da IA (login OAuth do Google Cloud) ficam **apenas** no servidor.
- Endpoints:

| Método | Rota | Função |
|---|---|---|
| GET | `/api/estilos` | Lista de estilos ativos, em ordem: `[{ id, nome, legenda, frases, miniaturaUrl }]` |
| GET | `/api/estilos/:id/miniatura` | Imagem da miniatura do estilo |
| POST | `/api/pintar` | Pinta a foto (detalhes abaixo) |
| GET | `/api/saude` | `{ ok, eventoAtivo, pinturasHoje, tetoDiario, fila }` |

- `POST /api/pintar`
  - Entrada (multipart): `foto` (JPEG), `estiloId`, `termosVersao`, `aceiteEm` (ISO 8601); cabeçalho `X-Aparelho`.
  - Passos: verificar interruptor de evento → verificar limites → validar estilo → validar foto (é imagem decodificável pelo `sharp`, até 5 MB, reencodar para JPEG sem metadados) → entrar na fila → chamar o provedor (com 1 nova tentativa automática em falha temporária) → gravar no acervo → responder.
  - Sucesso: `200`, corpo `image/jpeg` (a pintura), cabeçalho `X-Codigo-Obra`.
  - Erro: JSON `{ erro, mensagem }` (códigos na seção 7).

### 4.3 Provedor de IA

- Interface única: `pintar(foto: Buffer, estilo: Estilo): Promise<Buffer>`.
- Provedor escolhido por variável de ambiente `PROVEDOR`: `vertex` (produção) ou **`falso`** (devolve uma imagem fixa), usado em testes e no desenvolvimento.
- **Provedor: Google Cloud Vertex AI**, com os modelos de imagem Gemini ("Nano Banana"). O custo sai do **crédito da avaliação gratuita do Google Cloud** (US$ 300 por 90 dias) numa conta criada com um Gmail pessoal do usuário. Enquanto a conta não for convertida em paga, o Google não cobra nada além do crédito.
- **Autenticação só por login OAuth** com a conta Google do usuário (Application Default Credentials obtidas com `gcloud auth application-default login`), no comparativo e no servidor. Sem chave de API e sem conta de serviço.
- O teste comparativo escolhe o modelo entre Nano Banana 2.1, Nano Banana 2 e Nano Banana Pro (ids conferidos no Vertex AI na data do teste). Estimativa para 2.000 fotos: ~US$ 67, ~US$ 134 e ~US$ 268, todos dentro do crédito (o Pro fica no limite). O modelo escolhido fica na variável `MODELO_IMAGEM`.
- Antes de tudo, uma **chamada de teste** confirma que o crédito da avaliação libera o modelo de imagem. Se não liberar, o plano B é a fal.ai (paga por foto), trocando só o adaptador.
- O prompt enviado combina o prompt do estilo com uma instrução fixa de preservar rosto, pose e composição da foto. Se o estilo tiver `referencia.jpg`, ela também é enviada como imagem de referência.

### 4.4 Infraestrutura

- Docker Compose com dois serviços:
  - `caddy`: HTTPS automático no subdomínio escolhido, serve os arquivos do site e faz proxy de `/api/*` para o pintor;
  - `pintor`: o serviço Node.js.
- Volumes:
  - `estilos/` montado somente leitura no pintor;
  - `dados/acervo/` montado com escrita no pintor e **não** exposto pelo Caddy;
  - dados do Caddy (certificados);
  - o arquivo de credenciais do login OAuth (`application_default_credentials.json`) montado somente leitura no pintor, guardado fora do repositório e com permissão restrita.
- Configuração em `.env` (com `.env.exemplo` versionado, sem segredos).
- Se a VPS já tiver Nginx ou outro serviço ocupando as portas 80/443, o Caddy é substituído por um bloco de configuração no servidor existente.

## 5. Módulo de estilos

Os estilos são um **catálogo em pastas**, separado do código. Incluir um estilo novo não exige mudar código. Um estilo pode ser um movimento (Cubismo), um artista (Van Gogh) ou uma obra (Mona Lisa).

```
estilos/
  arte-grega/
    estilo.json
    miniatura.jpg
    referencia.jpg      (opcional)
  renascimento/
  cubismo/
  expressionismo/
  van-gogh/
  mona-lisa/
```

`estilo.json`:

```json
{
  "nome": "Van Gogh",
  "legenda": "A Noite Estrelada",
  "prompt": "Repaint this photo as a Vincent van Gogh oil painting in the style of The Starry Night (1889): thick impasto brushstrokes, swirling deep-blue sky...",
  "frases": ["Misturando os amarelos…", "Pintando o céu em espirais…", "Engrossando as pinceladas…", "Secando a tinta…"],
  "ordem": 5,
  "ativo": true
}
```

- O `id` do estilo é o nome da pasta.
- O código de leitura fica em um módulo próprio do servidor (`servidor/src/estilos/`), que carrega o catálogo ao iniciar o serviço.
- Uma pasta com `estilo.json` inválido ou sem `miniatura.jpg` é **ignorada com aviso no log**; o serviço não cai por causa dela.
- `"ativo": false` tira o estilo da tela sem apagá-lo.
- Para incluir um estilo: copiar uma pasta, trocar textos e imagens, reiniciar o pintor (`docker compose restart pintor`).
- `legenda` é a linha curta abaixo do nome no cartão; `frases` são as frases da revelação daquele estilo (ao menos uma).
- Miniatura e referência vêm de obras em domínio público ou com licença CC0:

| Estilo | Obra de referência |
|---|---|
| Arte Grega | Foto de um busto ou cabeça grega de mármore do acervo aberto do Metropolitan Museum (CC0) |
| Renascimento | Botticelli, *O Nascimento de Vênus* (c. 1485, Uffizi), recortado no rosto de Vênus |
| Cubismo | Juan Gris, *Retrato de Pablo Picasso* (1912, Art Institute of Chicago). As pinturas do próprio Picasso continuam protegidas por direito autoral no Brasil até o fim de 2043, então nenhuma delas entra no site; o estilo em si não é protegido |
| Expressionismo | Edvard Munch, *O Grito* (1893, Galeria Nacional, Oslo) |
| Van Gogh | *A Noite Estrelada* (1889, MoMA) |
| Mona Lisa | Leonardo da Vinci, *Mona Lisa* (1503–1519, Louvre) |

## 6. Acervo, privacidade e proteções

### 6.1 Acervo

- Uma obra só é gravada quando a pintura dá certo.
- Estrutura (datas no fuso `America/Sao_Paulo`):

```
dados/acervo/
  2026-11-20/
    K7M-3PX/
      original.jpg   ← foto real (já reencodada, sem metadados)
      pintura.jpg    ← imagem alterada, sem moldura
      info.json
```

- `info.json`: `codigo`, `criadoEm`, `estiloId`, `estiloNome`, `provedor`, `modelo`, `termosVersao`, `aceiteEm`. O IP não é guardado.
- Código da obra: 6 caracteres no formato `XXX-XXX`, sorteados de um alfabeto sem caracteres ambíguos (sem `0`, `O`, `1`, `I`, `L`). Se já existir pasta com o código, sorteia outro.
- A versão com moldura não é guardada; pode ser recomposta a partir de `pintura.jpg`.
- Localizar ou excluir uma obra a pedido: procurar `dados/acervo/*/<código>` e apagar a pasta.

### 6.2 Termos e consentimento

- Consentimento por clique no botão da tela inicial, com resumo visível e link para os termos completos.
- Os termos têm versão (ex.: `v1`). A versão aceita vai em cada `info.json`.
- O rascunho dos termos é produzido junto com o projeto e **deve ser revisado pela escola** antes do evento. Ele deve cobrir: quem guarda (a escola), o que é guardado (foto real e pintura), para quê (uso em eventos e divulgação da escola), que a foto é processada por um provedor de IA externo, por quanto tempo (proposta do rascunho: até 5 anos, ajustável pela escola), declaração de maioridade e como pedir exclusão (e-mail da escola + código da obra).

### 6.3 Proteções contra custo e abuso

Valores padrão, todos ajustáveis no `.env`:

| Proteção | Padrão | Comportamento |
|---|---|---|
| Interruptor de evento (`EVENTO_ATIVO`) | `false` fora do evento | Desligado: `/api/pintar` recusa e o site mostra "Esta experiência está disponível no estande". |
| Limite por aparelho | 5 pinturas / 10 min | Por `X-Aparelho`. Contorno possível (limpar o navegador), coberto pelos limites abaixo. |
| Limite por IP | 60 pinturas / hora | Alto de propósito: no Wi-Fi do evento muitos visitantes compartilham o mesmo IP. Barra robôs. |
| Teto diário global | 1.000 pinturas / dia | Contado pelas pastas do dia no acervo (sobrevive a reinícios). |
| Fila | 5 chamadas simultâneas ao provedor | Os demais esperam na fila; a revelação cobre a espera. |
| Tempo máximo | 90 s por pintura (incluindo fila e nova tentativa) | Passou disso, responde `TEMPO_ESGOTADO`. |

Os limites por aparelho e por IP contam pedidos que passaram da validação e entraram na fila (cada "Tentar de novo" conta). Ficam em memória e zeram ao reiniciar, o que é aceitável. O teto diário usa um contador em memória, iniciado pela contagem de pastas do dia ao subir o serviço, que soma as pinturas gravadas **e as em andamento**; assim pedidos simultâneos não ultrapassam o teto. Na avaliação gratuita o gasto já fica limitado ao crédito; se a conta virar paga, configurar um alerta de orçamento no Google Cloud.

### 6.4 Backup

- Script `scripts/backup-acervo.sh` gera `acervo-AAAA-MM-DD.zip` com todo o acervo.
- Rotina: ao fim de cada dia de evento, rodar o script e baixar o `.zip` para o computador ou Drive.
- Se a VPS oferecer snapshots automáticos, ativá-los.

## 7. Erros

| Código | HTTP | Quando | Mensagem ao visitante |
|---|---|---|---|
| `EVENTO_INATIVO` | 503 | Interruptor desligado | "Esta experiência está disponível no estande." |
| `LIMITE_APARELHO` | 429 | Limite por aparelho | "Calma, artista! Espere alguns minutinhos para pintar de novo." |
| `LIMITE_IP` | 429 | Limite por IP | Mesma mensagem acima. |
| `TETO_DIARIO` | 429 | Teto diário atingido | "A pintora foi descansar. Volte amanhã!" |
| `FOTO_INVALIDA` | 400 | Arquivo não é imagem ou é grande demais | "Não consegui abrir essa foto. Tente tirar outra." |
| `ESTILO_INVALIDO` | 400 | Estilo inexistente ou inativo | "Esse estilo não está disponível. Escolha outro." |
| `RECUSADA` | 422 | Provedor recusou a imagem (filtro de conteúdo) | "Não consegui pintar essa foto. Que tal tentar outra?" |
| `IA_INDISPONIVEL` | 502 | Provedor falhou mesmo após nova tentativa | "A pintora está com dificuldades. Tente de novo." |
| `TEMPO_ESGOTADO` | 504 | Passou do tempo máximo | "Demorou mais que o normal. Tente de novo." |

Falhas de rede do lado do celular (sem resposta, envio interrompido) mostram "Parece que a internet caiu. Tente de novo." O site tem tempo limite de 30 s para o envio da foto e 100 s para a resposta completa.

## 8. Testes

1. **Teste comparativo de modelos** (primeira tarefa da implementação): uma chamada de teste confirma que o crédito da avaliação cobre o modelo de imagem; depois, 10 fotos reais × 6 estilos × 3 modelos do Google, num painel lado a lado. O usuário escolhe visualmente; registram-se tempo médio e custo por foto.
2. **Automáticos do servidor** (Vitest, com provedor `falso`): leitura do catálogo (incluindo estilo inativo e pasta inválida), validação da foto, interruptor de evento, limites por aparelho e IP, teto diário, fila, nova tentativa automática, gravação do acervo (só no sucesso, estrutura de pastas, `info.json`), geração do código da obra.
3. **Automáticos do site** (Vitest): preparo da foto (rotação, redimensionamento, reencode) e composição da moldura.
4. **Fluxo completo** (Playwright, emulando iPhone e Android, com provedor `falso`): aceite → estilo → foto → revelação → resultado → salvar/compartilhar, mais os caminhos de erro e "Tentar de novo".
5. **Celulares reais**: iPhone (Safari), Android (Chrome), QR lido pela câmera nativa, pelo Instagram e pelo WhatsApp, um celular antigo, internet lenta simulada.
6. **Ensaio geral** na semana do evento: 20 a 30 pessoas usando ao mesmo tempo, com o provedor real.

## 9. Entregáveis

- Site, serviço pintor, módulo de estilos com os 6 estilos, configuração de deploy.
- Página `/termos` com rascunho dos termos de uso de imagem.
- Script de backup do acervo.
- QR code em alta resolução para impressão (SVG e PNG), com o endereço curto para imprimir abaixo.
- Checklist do dia do evento: ligar o interruptor de evento, conferir `/api/saude`, conferir saldo e validade do crédito no Google Cloud, roteador 4G no estande, cartaz com instruções ("1. Aponte a câmera · 2. Escolha o estilo · 3. Sorria"), backup ao fim de cada dia, desligar o interruptor depois do evento.

## 10. Estrutura do repositório

```
site/        frontend (Vite + TypeScript)
servidor/    serviço pintor (Node.js + Fastify)
estilos/     catálogo de estilos (dados)
deploy/      docker-compose.yml, Caddyfile, .env.exemplo
scripts/     backup-acervo.sh, comparativo de provedores, gerar QR code
docs/        specs, rascunho dos termos, checklist do evento
```

## 11. Riscos

- **Internet do local desconhecida**: cada foto depende de conexão. Mitigações: foto comprimida, "Tentar de novo" sem refazer a foto, roteador 4G próprio no estande.
- **Qualidade da IA**: o rosto pode ficar irreconhecível ou o estilo fraco. O risco é maior na Arte Grega (mármore, olhos sem pupila) e no Cubismo (rosto em planos). Mitigação: teste comparativo antes de construir o resto; se um estilo não ficar bom, ajustar o prompt ou desativá-lo (`"ativo": false`).
- **Recusas do filtro de conteúdo** do provedor: tratadas com mensagem amigável.
- **Navegadores embutidos** podem ignorar `capture` e abrir a galeria: aceito.
- **Custo**: teto diário, limites, interruptor de evento e o próprio limite do crédito da avaliação.
- **Crédito da avaliação do Google Cloud**: pode não liberar o modelo de imagem (plano B: fal.ai) e expira em 90 dias; eventos futuros vão precisar de conta paga ou de novos créditos.
- **Login OAuth no servidor**: o arquivo de credenciais dá acesso ao Google Cloud do usuário. Fica fora do repositório, com permissão restrita, e o acesso pode ser revogado na conta Google a qualquer momento. Se o login expirar ou for revogado, a pintura falha com `IA_INDISPONIVEL` e o log pede um novo login.

## 12. Insumos a fornecer pelo usuário

- Subdomínio a usar e acesso SSH à VPS (e se as portas 80/443 já estão em uso).
- Gmail pessoal com a avaliação gratuita do Google Cloud ativada, um projeto com a API do Vertex AI habilitada e o login OAuth feito (`gcloud auth application-default login`).
- Nome da escola e e-mail de contato para os termos.
- Texto da assinatura da moldura (@perfil ou #hashtag).
- Revisão dos termos pela escola.
- Data exata do evento.
