# syntax=docker/dockerfile:1
# Caddy: HTTPS, arquivos do site e proxy de /api/* para o pintor. Build a partir da raiz:
#   docker build -f deploy/caddy.Dockerfile .

# Build do site (Vite). A vitrine do tasteskill não entra: só existe com --mode vitrine.
FROM node:22-bookworm-slim AS site
WORKDIR /site
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY site/package.json site/package-lock.json ./
RUN npm ci --ignore-scripts
COPY site/ ./
RUN npm run build

FROM caddy:2.10-alpine
# Roda como usuário sem privilégios (uid 10001). O binário oficial vem com a capability de abrir
# as portas 80/443; ela é removida porque o contêiner sobe sem nenhuma capability e abre essas
# portas pelo sysctl net.ipv4.ip_unprivileged_port_start do docker-compose.yml.
RUN setcap -r /usr/bin/caddy \
    && addgroup -S -g 10001 caddy \
    && adduser -S -D -H -u 10001 -G caddy caddy \
    && chown -R caddy:caddy /data /config
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=site /site/dist /srv/site
USER caddy
