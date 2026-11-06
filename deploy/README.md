# Deploy num servidor com túnel do Cloudflare

Este guia sobe o projeto inteiro num servidor Linux qualquer, só com Docker. Pode ser uma VPS, uma máquina em casa ou um servidor atrás de NAT. O servidor não abre **nenhuma porta** para a internet: o `cloudflared` roda num contêiner e abre uma conexão de saída até o Cloudflare, e o HTTPS fica com o Cloudflare.

```
celular ──HTTPS──▶ Cloudflare ──túnel (saída do servidor)──▶ cloudflared ──▶ caddy ──/api/*──▶ pintor
                                                             rede "borda"     rede "default"
```

- **`cloudflared`** fica só na rede `borda`, junto com o Caddy. Ele não enxerga o pintor, então nem uma rota errada no painel do Cloudflare consegue expor a API direto.
- **`caddy`** serve o site e repassa `/api/*` ao pintor. Ele aceita o IP do visitante que vem do Cloudflare (`Cf-Connecting-Ip`), para o limite por IP valer para cada pessoa.
- **`pintor`** (a API) não tem porta nem fala com o Cloudflare. Guarda o acervo em `dados/acervo/`.

Os arquivos envolvidos são `deploy/docker-compose.yml` (pintor e Caddy) e `deploy/docker-compose.tunel.yml` (cloudflared, rede `borda` e o Caddy só em `127.0.0.1:5112`). O `cloudflared` só sobe com o perfil `cloudflared`.

## O que você vai precisar

| Item | Onde se consegue | Vai para |
|---|---|---|
| Servidor Linux com Docker | Qualquer provedor ou máquina própria | — |
| Domínio no Cloudflare | Painel do Cloudflare (o `yansalim.dev` já está lá) | Rota do túnel |
| Token do túnel | Painel do Cloudflare, passo 2 | `/etc/camera-ai/tunel-token.txt` |
| Login OAuth do Google | O arquivo que já existe no computador atual, ou `gcloud` no servidor | `/etc/camera-ai/adc.json` |
| Id do projeto no Google Cloud | Console do Google Cloud | `GOOGLE_CLOUD_PROJECT` no `deploy/.env` |
| Modelo de imagem | Escolhido no teste comparativo | `MODELO_IMAGEM` no `deploy/.env` |

### Requisitos do servidor

- Linux de 64 bits (Ubuntu 24.04 ou Debian 12 servem), com **2 GB de RAM** ou mais. Os limites somam 1,5 GB: pintor 1 GB, Caddy 256 MB e cloudflared 256 MB.
- Docker Engine 24 ou mais novo, com o plugin Compose v2, e o `git`.
- Saída para a internet nas portas 443 e 7844 (TCP e UDP), que o túnel usa. Nenhuma porta de entrada.
- Pelo menos 10 GB de disco livre para as imagens e o acervo. Cada pintura ocupa cerca de 1 MB, somando a original e a pintada.

## Passo a passo

### 1. Preparar o servidor

Instale o Docker pelo script oficial e deixe-o iniciar com o sistema:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # saia e entre de novo na sessão SSH
```

Feche as portas de entrada. Só o SSH continua aberto; o túnel não precisa de nenhuma:

```bash
sudo ufw default deny incoming
sudo ufw allow OpenSSH
sudo ufw enable
```

Clone o repositório:

```bash
git clone https://github.com/yansalim/camera-ai.git && cd camera-ai
```

### 2. Criar o túnel no Cloudflare

1. No painel do Cloudflare, abra **Zero Trust → Networks → Tunnels → Create a tunnel**, escolha **Cloudflared** e dê um nome (por exemplo `camera-ai-servidor`).
2. Na tela de instalação, copie o **token**: é o texto longo depois de `--token` no comando que aparece. Você não precisa rodar esse comando, porque o contêiner faz o papel dele.
3. Em **Public Hostnames**, adicione a rota:
   - **Subdomain / Domain:** um endereço de teste, por exemplo `camera-ia-servidor.yansalim.dev`. Um nome só pode estar num túnel de cada vez, e o `camera-ia.yansalim.dev` está hoje no túnel do computador. A troca do endereço é o passo 8.
   - **Service:** `HTTP` e URL `caddy:80`. Não use `localhost:5112`: dentro do contêiner, `localhost` é o próprio cloudflared.
4. Em **Speed → Optimization** e em **Scrape Shield**, deixe desligados **Rocket Loader** e **Email Address Obfuscation**. Em **Web Analytics**, não ative a injeção automática. Os scripts que eles colocam na página são bloqueados pelo CSP do site.

Guarde o token no servidor, fora do repositório, legível só pelo usuário do cloudflared (uid 65532). Cole o token, aperte Enter e depois Ctrl+D:

```bash
sudo install -D -o 65532 -g 65532 -m 0400 /dev/stdin /etc/camera-ai/tunel-token.txt
```

O token dá controle do túnel: não o coloque no `deploy/.env`, no git nem em mensagens.

### 3. Levar o login do Google

O pintor usa o login OAuth do Google (Application Default Credentials), sem chave de API. Escolha um dos dois caminhos.

**Copiar o login que já existe no computador atual** (mais simples). No Windows, o arquivo fica em `%APPDATA%\gcloud\application_default_credentials.json`. Envie-o para o servidor e instale-o com dono uid 1000, que é o usuário do pintor:

```bash
# no computador atual (Git Bash ou PowerShell)
scp "$APPDATA/gcloud/application_default_credentials.json" usuario@servidor:/tmp/adc.json
```

```bash
# no servidor
sudo install -D -o 1000 -g 1000 -m 0400 /tmp/adc.json /etc/camera-ai/adc.json && rm /tmp/adc.json
```

**Ou fazer um login novo no servidor**, com a [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) instalada. O comando mostra um link para abrir no navegador de outro aparelho:

```bash
gcloud auth application-default login --no-launch-browser
gcloud auth application-default set-quota-project SEU_PROJETO
sudo install -D -o 1000 -g 1000 -m 0400 ~/.config/gcloud/application_default_credentials.json /etc/camera-ai/adc.json
```

Esse arquivo dá acesso à conta do Google Cloud. Ele fica só em `/etc/camera-ai/` e chega ao pintor somente leitura.

### 4. Preencher o `deploy/.env`

```bash
cp deploy/.env.exemplo deploy/.env
nano deploy/.env
```

O que muda em relação ao exemplo:

| Variável | Valor | Por quê |
|---|---|---|
| `DOMINIO` | `:80` | O Caddy só fala HTTP; o HTTPS é do Cloudflare |
| `PROVEDOR` | `vertex` | Pinta com a IA do Google (`falso` devolve a própria foto, para teste) |
| `GOOGLE_CLOUD_PROJECT` | o id do projeto | O mesmo do login do passo 3 |
| `GOOGLE_CLOUD_LOCATION` | `global` | Região do Vertex AI |
| `MODELO_IMAGEM` | `gemini-nano-banana-2.1` | O modelo em uso hoje (cerca de US$ 0,04 por imagem) |
| `ADC_ARQUIVO` | `/etc/camera-ai/adc.json` | Login do passo 3 |
| `TUNEL_TOKEN_ARQUIVO` | `/etc/camera-ai/tunel-token.txt` | Token do passo 2 |
| `EVENTO_ATIVO` | `true` no dia do evento | Com `false`, o site mostra "Experiência pausada" |

As proteções de custo (`LIMITE_*`, `TETO_DIARIO`, `CONCORRENCIA`, `TEMPO_MAXIMO_S`) podem ficar vazias, e aí valem os padrões. A tabela completa está no [README principal](../README.md#variáveis-do-deployenv). Mantenha `TEMPO_MAXIMO_S` abaixo de 100, porque o Cloudflare corta respostas que demoram mais que isso.

### 5. Criar a pasta do acervo

```bash
mkdir -p dados/acervo && sudo chown 1000:1000 dados/acervo
```

### 6. Subir

Para não repetir os arquivos do Compose em todo comando, deixe-os no ambiente da sessão. O `verificar.sh` também usa essas variáveis:

```bash
cat >> ~/.bashrc <<'EOF'
export COMPOSE_FILE=deploy/docker-compose.yml:deploy/docker-compose.tunel.yml
export COMPOSE_PROFILES=cloudflared
EOF
source ~/.bashrc
```

Construa e suba os três serviços. Rode a partir da pasta `camera-ai`:

```bash
docker compose up -d --build
```

O primeiro build leva alguns minutos. Depois, os três devem aparecer como `healthy` ou `running`:

```bash
docker compose ps
```

### 7. Conferir

```bash
curl https://camera-ia-servidor.yansalim.dev/api/saude
```

A resposta deve trazer `"ok":true`. Confira as proteções pelos dois lados. Pelo endereço público, o script confere cabeçalhos, contêineres e redes; pela porta local, confere também a recusa de envios acima de 6 MB, que o Cloudflare segura antes de repassar:

```bash
bash deploy/verificar.sh https://camera-ia-servidor.yansalim.dev
bash deploy/verificar.sh http://localhost:5112
```

Os dois devem terminar com "Tudo certo.". Por fim, abra o endereço no celular e faça uma pintura completa, para confirmar a câmera, o login do Google e o acervo.

### 8. Trocar o endereço do evento para o servidor

Quando o servidor estiver aprovado:

1. No túnel **antigo** (o do computador), remova a rota `camera-ia.yansalim.dev` em **Public Hostnames**.
2. No túnel **novo**, adicione `camera-ia.yansalim.dev` com o mesmo serviço `HTTP` → `caddy:80`. O QR code continua o mesmo.
3. No computador antigo, desligue o site e o serviço do túnel (PowerShell como administrador):

   ```powershell
   docker compose -p camera-ai-teste down
   Stop-Service cloudflared; Set-Service cloudflared -StartupType Disabled
   ```

4. Se quiser levar as pinturas que já estão no computador antigo, copie a pasta do acervo e acerte o dono:

   ```bash
   # no computador antigo, a partir da pasta onde o site rodava
   scp -r dados/acervo/. usuario@servidor:camera-ai/dados/acervo/
   ```

   ```bash
   # no servidor
   sudo chown -R 1000:1000 dados/acervo
   ```

## Operação

Todos os comandos rodam a partir da pasta `camera-ai`, com as variáveis do passo 6 já no ambiente.

| Tarefa | Comando |
|---|---|
| Ligar ou desligar o evento | Mude `EVENTO_ATIVO` no `deploy/.env` e rode `docker compose up -d pintor` (o `restart` não relê o `.env`) |
| Recarregar os estilos depois de mudar `estilos/` | `docker compose restart pintor` |
| Atualizar o código | `git pull && docker compose up -d --build` |
| Ver os logs | `docker compose logs -f pintor` (ou `caddy`, `cloudflared`) |
| Ver quantas pinturas foram feitas hoje | `curl -s http://localhost:5112/api/saude` |
| Trocar o login do Google | Repita o passo 3 e rode `docker compose up -d --force-recreate pintor` |
| Trocar o token do túnel | Repita a gravação do token (passo 2) e rode `docker compose up -d --force-recreate cloudflared` |
| Parar tudo | `docker compose down` (o acervo em `dados/acervo/` não é apagado) |

A versão do `cloudflared` é fixa no `docker-compose.tunel.yml` (`cloudflare/cloudflared:2026.3.0`). Para atualizar, troque a versão no arquivo e rode `docker compose up -d cloudflared`.

**Backup do acervo.** O acervo só existe no servidor. Gere um arquivo e baixe-o para outra máquina:

```bash
tar -czf ~/acervo-$(date +%F).tar.gz -C dados acervo
```

```bash
# na sua máquina
scp usuario@servidor:acervo-AAAA-MM-DD.tar.gz .
```

Se o provedor do servidor oferecer snapshots automáticos do disco, ative-os também.

## Quando algo dá errado

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Erro 1033 do Cloudflare | O túnel não está conectado | `docker compose logs cloudflared`. "Provided Tunnel token is not valid" é token errado ou com espaço sobrando: grave-o de novo |
| Erro 502 do Cloudflare | Rota do túnel apontando para o lugar errado | No painel, o serviço deve ser `HTTP` → `caddy:80` |
| `cloudflared` reinicia sem parar com "permission denied" | O arquivo do token não é do uid 65532 | Repita o `install` do passo 2 |
| O site abre, mas toda pintura falha | Login do Google ilegível, vencido ou revogado | `docker compose logs pintor`. Repita o passo 3 e recrie o pintor |
| O pintor não sobe: "Variável ... obrigatória com PROVEDOR=vertex" | Falta `GOOGLE_CLOUD_PROJECT` ou `MODELO_IMAGEM` | Preencha o `deploy/.env` e rode `docker compose up -d` |
| "Experiência pausada" no site | `EVENTO_ATIVO=false` | Mude para `true` e rode `docker compose up -d pintor` |
| Muitos visitantes recebem "calma" (429) juntos | Limite por IP valendo para todos | Confira se o `verificar.sh` passa e se o Caddy recebeu `PROXIES_CONFIAVEIS` (`docker compose config \| grep PROXIES`) |
| A página abre sem estilo ou sem script | Rocket Loader ou Email Obfuscation ligados | Desligue-os no painel (passo 2.4) |

## Sem túnel: VPS com IP público

Se o servidor tiver IP público e você preferir que o próprio Caddy emita o certificado (Let's Encrypt), use só o `deploy/docker-compose.yml`, com `DOMINIO` igual ao subdomínio e as portas 80 e 443 abertas. O passo a passo está no [README principal](../README.md#deploy). Nesse modo, não defina `COMPOSE_FILE` nem `COMPOSE_PROFILES`.
