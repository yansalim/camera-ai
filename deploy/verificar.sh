#!/usr/bin/env bash
# Confere as proteções do deploy: o que vai para o git, a configuração do Compose,
# os contêineres rodando e os cabeçalhos HTTP do site.
#
# Uso:  bash deploy/verificar.sh                   (só repositório e Compose)
#       bash deploy/verificar.sh https://SUBDOMINIO (também contêineres e HTTP; precisa do Compose no ar)
#
# Sai com código 1 se alguma conferência falhar.
set -uo pipefail
# No Git Bash (Windows), impede que /run/... vire C:/Program Files/Git/run/... nos argumentos do docker.
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f deploy/docker-compose.yml)
# Sem deploy/.env (no computador de desenvolvimento), o exemplo basta para validar o Compose.
[ -f deploy/.env ] || COMPOSE+=(--env-file deploy/.env.exemplo)
URL="${1:-}"
URL="${URL%/}"
falhas=0

ok() { printf '  ok     %s\n' "$1"; }
falha() { printf '  FALHA  %s\n' "$1"; falhas=$((falhas + 1)); }
confere() {
  local descricao="$1"
  shift
  if "$@" >/dev/null 2>&1; then ok "$descricao"; else falha "$descricao"; fi
}

echo "Repositório (o código é público)"
for arquivo in .env deploy/.env deploy/.env.producao deploy/adc-vazio.json \
  application_default_credentials.json deploy/application_default_credentials.json \
  dados/acervo/2026-01-01/ABC-234/original.jpg dados/backups/acervo.zip \
  deploy/docker-compose.override.yml deploy/compose.override.yaml segredos/chave.pem; do
  confere "o git ignora $arquivo" git check-ignore -q "$arquivo"
done
for arquivo in deploy/.env.exemplo deploy/docker-compose.yml deploy/Caddyfile \
  deploy/pintor.Dockerfile deploy/caddy.Dockerfile .dockerignore; do
  confere "o git versiona $arquivo" test -f "$arquivo" -a -z "$(git check-ignore "$arquivo")"
done
sensiveis=$(git ls-files | grep -iE '(^|/)\.env($|\.)|credentials.*\.json$|\.(pem|key|p12|pfx)$' | grep -v '\.env\.exemplo$')
if [ -z "$sensiveis" ]; then ok "nenhum arquivo sensível versionado"; else falha "arquivos sensíveis versionados: $sensiveis"; fi
confere "nenhuma chave ou token no conteúdo versionado" \
  bash -c "! git grep -qIE 'AIza[0-9A-Za-z_-]{35}|\"(private_key|refresh_token|client_secret)\"|-----BEGIN [A-Z ]*PRIVATE KEY' -- . ':!deploy/verificar.sh'"
for padrao in '**/.env' '**/.env.*' '**/*application_default_credentials*.json' 'dados' '**/node_modules'; do
  confere "o .dockerignore deixa $padrao fora das imagens" grep -qxF "$padrao" .dockerignore
done

echo "Compose"
confere "docker compose config é válido" "${COMPOSE[@]}" config -q

if [ -z "$URL" ]; then
  echo
  echo "Sem URL: contêineres e HTTP não conferidos."
else
  echo "Contêineres"
  for servico in pintor caddy; do
    id=$("${COMPOSE[@]}" ps -q "$servico" 2>/dev/null)
    if [ -z "$id" ]; then
      falha "$servico está rodando"
      continue
    fi
    ver() { docker inspect --format "$1" "$id"; }
    uid=$(docker exec "$id" id -u 2>/dev/null)
    confere "$servico roda sem root (uid ${uid:-?})" test -n "$uid" -a "$uid" != 0
    confere "$servico tem o sistema de arquivos somente leitura" test "$(ver '{{.HostConfig.ReadonlyRootfs}}')" = true
    confere "$servico não é privilegiado" test "$(ver '{{.HostConfig.Privileged}}')" = false
    confere "$servico descarta todas as capabilities" test "$(ver '{{json .HostConfig.CapDrop}}')" = '["ALL"]'
    confere "$servico não recebe capability extra" test "$(ver '{{len .HostConfig.CapAdd}}')" = 0
    confere "$servico não ganha privilégios depois de iniciar" grep -q no-new-privileges <<<"$(ver '{{json .HostConfig.SecurityOpt}}')"
    confere "$servico tem limite de memória" test "$(ver '{{.HostConfig.Memory}}')" -gt 0
    confere "$servico tem limite de processos" test "$(ver '{{.HostConfig.PidsLimit}}')" -gt 0
    montagens=$(ver '{{range .Mounts}}{{.Destination}}:{{.RW}} {{end}}')
    if [ "$servico" = pintor ]; then
      confere "pintor não publica porta (só o Caddy fala com ele)" test "$(ver '{{len .HostConfig.PortBindings}}')" = 0
      confere "pintor monta os estilos somente leitura" grep -q '/app/estilos:false' <<<"$montagens"
      confere "pintor recebe o login do Google somente leitura" grep -q '/run/secrets/adc:false' <<<"$montagens"
      # O Vertex só lê o login na primeira pintura: sem estas duas, /api/saude responde ok e toda pintura falha.
      confere "pintor consegue ler o login do Google (dono uid 1000)" docker exec "$id" test -r /run/secrets/adc
      if [ "$(docker exec "$id" printenv PROVEDOR)" = vertex ]; then
        confere "o login do Google não está vazio" docker exec "$id" test -s /run/secrets/adc
      fi
      confere "pintor consegue gravar o acervo (dono uid 1000)" docker exec "$id" test -w /dados/acervo
      confere "pintor não leva npm, código-fonte nem testes" \
        docker exec "$id" sh -c '! command -v npm && test ! -e /app/src -a ! -e /app/test'
    else
      confere "caddy não monta o acervo" bash -c "! grep -qi acervo <<<'$montagens'"
      confere "caddy não leva a vitrine nem mapas de código" \
        docker exec "$id" sh -c 'test ! -e /srv/site/vitrine.html && ! find /srv/site -name "*.map" | grep -q .'
    fi
    confere "$servico não tem .env nem credenciais na imagem" \
      docker exec "$id" sh -c '! find /app /srv /etc/caddy -name ".env*" -o -name "*credentials*.json" 2>/dev/null | grep -q .'
  done

  echo "HTTP ($URL)"
  cabecalhos=$(curl -ksSI -m 15 "$URL/")
  for cabecalho in content-security-policy x-content-type-options referrer-policy permissions-policy x-frame-options cross-origin-opener-policy; do
    confere "o site envia $cabecalho" grep -qi "^$cabecalho:" <<<"$cabecalhos"
  done
  if [[ $URL == https://* ]]; then
    confere "o site envia strict-transport-security" grep -qi '^strict-transport-security:' <<<"$cabecalhos"
  fi
  confere "o site não anuncia o servidor" bash -c "! grep -qi '^server:' <<<'$cabecalhos'"
  confere "a câmera só vale para o próprio site" grep -qi '^permissions-policy:.*camera=(self)' <<<"$cabecalhos"
  confere "/api/saude responde ok" grep -q '"ok":true' <<<"$(curl -ksS -m 15 "$URL/api/saude")"
  # Anuncia 7 MB e manda 1 byte: só o Caddy, olhando o Content-Length, responde na hora.
  # Se o pedido chegasse ao pintor, ele ficaria esperando o resto do corpo até o tempo acabar.
  codigo=$(curl -ks -m 10 -o /dev/null -w '%{http_code}' -X POST -H 'Content-Length: 7000000' \
    -H 'Content-Type: multipart/form-data; boundary=x' --data-binary x "$URL/api/pintar")
  confere "envio anunciado acima de 6 MB é recusado antes do pintor (HTTP $codigo)" test "$codigo" = 413
  host=${URL#*://}
  host=${host%%[:/]*}
  if [ "$host" != localhost ] && [ "$host" != 127.0.0.1 ]; then
    # Com IPv6, o Docker repassa os visitantes ao Caddy com um mesmo IP e o limite por IP vira um só para todos.
    confere "o subdomínio não responde por IPv6 (sem registro AAAA)" \
      bash -c "! curl -6 -ks -m 10 -o /dev/null --connect-timeout 5 '$URL/'"
  fi
  for caminho in /dados/acervo/ /acervo/ /.env /deploy/.env; do
    tipo=$(curl -ks -m 15 -o /dev/null -w '%{content_type}' "$URL$caminho")
    confere "$caminho não expõe arquivos (devolve a página do site)" test "${tipo%%;*}" = text/html
  done
fi

echo
if [ "$falhas" -eq 0 ]; then echo "Tudo certo."; else echo "$falhas conferência(s) falharam."; fi
exit $((falhas > 0))
