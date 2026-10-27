# camera-ai

Projeto de estudo de **IA generativa de imagens**: um site aberto por QR code em que a pessoa tira uma foto com o celular e recebe essa foto refeita em um de 6 estilos de arte: Arte Grega, Renascimento, Cubismo, Expressionismo, Van Gogh ou Mona Lisa.

> **Status:** em planejamento. A [especificação](docs/superpowers/specs/2026-10-27-experiencia-van-gogh-qrcode-design.md) e o [plano de implementação](docs/superpowers/plans/2026-10-27-experiencia-van-gogh-qrcode.md) estão prontos; o código será construído seguindo o plano. Os comandos abaixo descrevem como o projeto vai funcionar quando as etapas estiverem concluídas.

## A ideia

O projeto é um exercício prático para aprender a usar IA generativa num produto real, de ponta a ponta:

- **Imagem para imagem:** enviar uma foto e um prompt a um modelo de edição de imagem e receber a mesma cena em outro estilo, com o rosto ainda reconhecível.
- **Prompt de estilo:** cada estilo tem seu próprio prompt e, opcionalmente, uma imagem de referência.
- **Comparar provedores:** um adaptador único permite trocar de modelo por variável de ambiente e rodar um teste comparativo lado a lado (qualidade, tempo e custo).
- **Operar IA com custo sob controle:** fila de chamadas, limites por aparelho e por IP, teto diário e um interruptor para ligar e desligar a experiência.
- **Entregar no celular sem app:** site estático, câmera nativa do aparelho e compartilhamento pelo menu do próprio celular.

O cenário de uso é um estande de evento: um QR code impresso leva ao site e cada visitante sai com uma "obra de arte" sua para compartilhar.

## Como funciona

### Fluxo no celular

1. A pessoa lê o QR code e abre o site, sem instalar nada.
2. Escolhe um estilo: Arte Grega (estátua de mármore), Renascimento (Botticelli), Cubismo (Picasso), Expressionismo (Munch, *O Grito*), Van Gogh (*A Noite Estrelada*) ou Mona Lisa (Leonardo da Vinci).
3. Toca em **Tirar foto**, que abre a câmera nativa do celular.
4. O site corrige a rotação, reduz a foto para no máximo 1600 px e envia um JPEG de cerca de 300 a 500 KB.
5. Enquanto a IA trabalha (5 a 20 s), uma animação de pinceladas "pinta" a foto na tela, com frases próprias do estilo escolhido.
6. A obra aparece com ou sem uma moldura dourada, desenhada no próprio celular, pronta para **compartilhar** ou **salvar**.

### Arquitetura

```mermaid
flowchart LR
  celular["Celular<br/>(navegador)"] -- HTTPS --> caddy
  subgraph vps["VPS · Docker Compose"]
    caddy["caddy<br/>HTTPS automático"] -- "/" --> site["site estático<br/>(build do Vite)"]
    caddy -- "/api/*" --> pintor["pintor<br/>Node.js + Fastify"]
    pintor --> estilos[("estilos/<br/>catálogo de estilos")]
    pintor --> acervo[("dados/acervo/<br/>foto + pintura")]
  end
  pintor -- "foto + prompt" --> ia["Google Cloud Vertex AI<br/>(modelos de imagem Gemini)"]
```

| Parte | Tecnologia | Papel |
|---|---|---|
| `site/` | Vite + TypeScript, sem framework | Telas, preparo da foto, chamada à API, moldura, compartilhar e salvar |
| `servidor/` (serviço "pintor") | Node.js 22, Fastify, `sharp` | Valida a foto, aplica as proteções, chama a IA e grava o acervo |
| `estilos/` | Pastas com JSON e imagens | Catálogo de estilos, separado do código |
| `deploy/` | Docker Compose + Caddy | HTTPS, arquivos do site e proxy para a API |

As credenciais da IA (o login OAuth do Google Cloud) ficam só no servidor; o site nunca as recebe.

### API do pintor

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/estilos` | Lista os estilos ativos, em ordem, com nome, legenda e frases da animação |
| `GET` | `/api/estilos/:id/miniatura` | Miniatura de um estilo |
| `POST` | `/api/pintar` | Recebe a foto e devolve a pintura (`image/jpeg`) com o cabeçalho `X-Codigo-Obra` |
| `GET` | `/api/saude` | Estado do serviço: evento ativo, pinturas do dia, teto e tamanho da fila |

O caminho de um pedido em `POST /api/pintar`:

```
foto ─▶ evento ativo? ─▶ pedido válido? (estilo existe, foto ≤ 5 MB, reencode sem metadados)
     ─▶ limite por aparelho e por IP ─▶ teto diário ─▶ fila (5 chamadas simultâneas)
     ─▶ provedor de IA (1 nova tentativa em falha temporária, até 90 s no total)
     ─▶ grava no acervo ─▶ responde a pintura + código da obra
```

Quando algo falha, a resposta é um JSON `{ erro, mensagem }` com uma mensagem amigável que o site mostra, junto com um botão **Tentar de novo** que reenvia a mesma foto.

### Módulo de estilos

Cada estilo é uma pasta em `estilos/`; o nome da pasta é o `id` do estilo. Um estilo pode ser um movimento (Cubismo), um artista (Van Gogh) ou uma obra (Mona Lisa).

```
estilos/
  arte-grega/  renascimento/  cubismo/  expressionismo/  van-gogh/  mona-lisa/
    estilo.json
    miniatura.jpg
    referencia.jpg      (opcional, enviada ao modelo como referência de estilo)
```

```json
{
  "nome": "Van Gogh",
  "legenda": "A Noite Estrelada",
  "prompt": "Repaint this photo as a Vincent van Gogh oil painting in the style of The Starry Night (1889)...",
  "frases": ["Misturando os amarelos…", "Pintando o céu em espirais…", "Engrossando as pinceladas…", "Secando a tinta…"],
  "ordem": 5,
  "ativo": true
}
```

- `legenda` é a linha abaixo do nome no cartão; `frases` alternam na tela enquanto a IA trabalha.
- Para incluir um estilo: copie uma pasta, edite o `estilo.json`, gere as imagens com `npx tsx scripts/preparar-estilo.ts <imagem-da-obra> <pasta-do-estilo> [x,y,largura,altura]` (dentro de `servidor/`; o recorte é opcional) e reinicie o pintor.
- `"ativo": false` esconde o estilo sem apagá-lo.
- As imagens de referência são obras em domínio público ou com licença CC0.
- Uma pasta inválida é ignorada com um aviso no log; o serviço continua de pé.
- Os prompts ficam em inglês, que os modelos de imagem seguem melhor.

### Provedores de IA

Todos os provedores implementam a mesma interface, `pintar(foto, estilo): Promise<Buffer>`, e o ativo é escolhido pela variável `PROVEDOR`.

- **`falso`** existe sempre: devolve a própria foto com um filtro, sem custo. Serve para desenvolvimento e testes.
- **`vertex`** usa o Google Cloud Vertex AI com os modelos de imagem Gemini ("Nano Banana"). A autenticação é só pelo login OAuth da conta Google (Application Default Credentials), sem chave de API.
- O prompt enviado junta o prompt do estilo com uma instrução fixa para preservar rosto, pose e composição da foto.
- Um teste comparativo escolhe entre Nano Banana 2.1, 2 e Pro (qualidade, tempo e custo); o modelo escolhido fica em `MODELO_IMAGEM`.

### Acervo

Cada pintura bem-sucedida é gravada em `dados/acervo/AAAA-MM-DD/<código>/` com `original.jpg`, `pintura.jpg` e `info.json` (estilo, provedor, modelo e data). O código da obra tem o formato `XXX-XXX`, sem caracteres ambíguos. A pasta `dados/` não é servida por HTTP nem versionada.

## Estrutura do repositório

```
site/        frontend (Vite + TypeScript)
servidor/    serviço "pintor" (Node.js + Fastify)
estilos/     catálogo de estilos (dados, não código)
deploy/      docker-compose.yml, Caddyfile, Dockerfiles, .env.exemplo
scripts/     backup do acervo e geração do QR code
docs/        especificação, plano de implementação e checklists
```

## Desenvolvimento local

Pré-requisito: Node.js 22 LTS. Com o provedor `falso` não é preciso nenhuma credencial de IA.

Instale as dependências:

```bash
npm --prefix servidor install
```

```bash
npm --prefix site install
```

Suba o pintor em `http://localhost:3000`:

```bash
PROVEDOR=falso EVENTO_ATIVO=true npm --prefix servidor run dev
```

Em outro terminal, suba o site em `http://localhost:5173` (o Vite encaminha `/api` para o pintor):

```bash
npm --prefix site run dev
```

### Testes

| Comando | O que testa |
|---|---|
| `npm --prefix servidor test` | Servidor com Vitest e provedor `falso` |
| `npm --prefix site test` | Preparo da foto e moldura (Vitest no navegador) |
| `npm --prefix site run e2e` | Fluxo completo com Playwright, emulando iPhone e Android |

Antes do primeiro e2e, instale os navegadores do Playwright:

```bash
cd site && npx playwright install chromium webkit
```

## Deploy

O deploy roda numa VPS Linux com Docker Compose e dois serviços:

- **`caddy`** publica as portas 80 e 443, emite o certificado HTTPS (Let's Encrypt), serve o build do site e faz proxy de `/api/*` para o pintor.
- **`pintor`** não publica porta; só o Caddy fala com ele. Monta `estilos/` como somente leitura e `dados/acervo/` com escrita. O Caddy não tem acesso ao acervo.

### Requisitos

- VPS com Docker e o plugin Compose.
- Um subdomínio com registro DNS apontando para o IP da VPS.
- Portas 80 e 443 livres.
- Um projeto no Google Cloud com a API do Vertex AI habilitada e a [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) instalada na VPS.

### Passo a passo

1. Clone o repositório na VPS:

   ```bash
   git clone https://github.com/yansalim/camera-ai.git && cd camera-ai
   ```

2. Crie o `.env` a partir do exemplo e preencha:

   ```bash
   cp deploy/.env.exemplo deploy/.env
   ```

3. Faça o login OAuth do Google Cloud na VPS. O comando mostra um link para abrir no navegador de outro aparelho:

   ```bash
   gcloud auth application-default login --no-launch-browser
   ```

   Aponte `ADC_ARQUIVO` no `.env` para o arquivo gerado (`~/.config/gcloud/application_default_credentials.json`). Ele fica fora do repositório, legível só pelo dono e pelo usuário do contêiner (uid 1000).

4. Crie a pasta do acervo com o dono do usuário do contêiner (`node`, uid 1000):

   ```bash
   mkdir -p dados/acervo && sudo chown 1000:1000 dados/acervo
   ```

5. Construa e suba os serviços:

   ```bash
   docker compose -f deploy/docker-compose.yml up -d --build
   ```

6. Confira se o serviço respondeu `"ok":true`:

   ```bash
   curl https://SEU_SUBDOMINIO/api/saude
   ```

### Variáveis do `deploy/.env`

| Variável | Padrão | Uso |
|---|---|---|
| `DOMINIO` | — | Subdomínio público; o Caddy emite o certificado para ele |
| `PROVEDOR` | `falso` | Provedor de IA ativo: `falso` ou `vertex` |
| `GOOGLE_CLOUD_PROJECT` | — | Id do projeto no Google Cloud (obrigatório com `vertex`) |
| `GOOGLE_CLOUD_LOCATION` | `global` | Região do Vertex AI |
| `MODELO_IMAGEM` | — | Modelo de imagem escolhido no teste comparativo (obrigatório com `vertex`) |
| `ADC_ARQUIVO` | — | Caminho, na VPS, do arquivo do login OAuth; montado somente leitura no pintor |
| `EVENTO_ATIVO` | `false` | Interruptor: desligado, `/api/pintar` recusa pedidos |
| `LIMITE_APARELHO` / `JANELA_APARELHO_MIN` | `5` / `10` | Pinturas por aparelho na janela, em minutos |
| `LIMITE_IP` / `JANELA_IP_MIN` | `60` / `60` | Pinturas por IP na janela, em minutos |
| `TETO_DIARIO` | `1000` | Máximo de pinturas por dia |
| `CONCORRENCIA` | `5` | Chamadas simultâneas ao provedor |
| `TEMPO_MAXIMO_S` | `90` | Tempo máximo de uma pintura, incluindo fila e nova tentativa |

`PORTA`, `ESTILOS_DIR` e `ACERVO_DIR` já vêm definidos na imagem do pintor.

### Operação

Ligar ou desligar a experiência: altere `EVENTO_ATIVO` no `deploy/.env` e recrie o pintor (`restart` não relê o `.env`):

```bash
docker compose -f deploy/docker-compose.yml up -d pintor
```

Recarregar o catálogo depois de mudar algo em `estilos/`:

```bash
docker compose -f deploy/docker-compose.yml restart pintor
```

Atualizar o código:

```bash
git pull && docker compose -f deploy/docker-compose.yml up -d --build
```

Acompanhar os logs do pintor:

```bash
docker compose -f deploy/docker-compose.yml logs -f pintor
```

Gerar o backup do acervo em `dados/backups/acervo-AAAA-MM-DD.zip`, para baixar depois por `scp`:

```bash
bash scripts/backup-acervo.sh .
```

Gerar o QR code para impressão (`qrcode.svg` e `qrcode.png`, 2000 px):

```bash
npm --prefix scripts install && node scripts/gerar-qrcode.mjs https://SEU_SUBDOMINIO
```

Se a VPS já tiver Nginx ou outro serviço nas portas 80/443, troque o Caddy por um bloco no servidor existente com o mesmo roteamento: `/api/*` para o pintor e o resto para os arquivos de `site/dist`.

## Planejamento

O trabalho está dividido em 17 tarefas, detalhadas no [plano de implementação](docs/superpowers/plans/2026-10-27-experiencia-van-gogh-qrcode.md). As decisões de produto e de arquitetura estão na [especificação](docs/superpowers/specs/2026-10-27-experiencia-van-gogh-qrcode-design.md).

- [ ] 1. Servidor base e módulo de estilos com os 6 estilos
- [ ] 2. Interface de provedor, provedor `falso` e configuração
- [ ] 3. Adaptador Vertex AI (login OAuth) e teste comparativo entre modelos do Google
- [ ] 4. Acervo: código da obra e gravação
- [ ] 5. Proteções: limitador, teto diário e fila
- [ ] 6. Preparo de imagens no servidor
- [ ] 7. App Fastify, erros e rotas de estilos e saúde
- [ ] 8. Rota `POST /api/pintar`
- [ ] 9. Site base, armazenamento local e cliente da API
- [ ] 10. Preparo da foto e moldura no site
- [ ] 11. Direção visual com o tasteskill (`design-taste-frontend`)
- [ ] 12. Telas de início, termos, escolha do estilo e foto, com a base dos testes e2e
- [ ] 13. Revelação, resultado, erros e compartilhamento
- [ ] 14. Olhar e movimento com o tasteskill
- [ ] 15. Deploy com Docker Compose e Caddy
- [ ] 16. Operação: backup, QR code e checklist do evento
- [ ] 17. Publicação na VPS e testes em celulares reais

A tarefa 3 precisa do login no Google Cloud e de fotos de teste, então pode correr em paralelo às tarefas 4 a 14, que usam o provedor `falso`.
