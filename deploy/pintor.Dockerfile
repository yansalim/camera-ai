# syntax=docker/dockerfile:1
# Pintor (API em Node.js). Build a partir da raiz do repositório:
#   docker build -f deploy/pintor.Dockerfile .
# A imagem final leva só o JavaScript compilado e as dependências de produção,
# sem npm, sem código-fonte e sem testes, e roda como o usuário sem privilégios `node` (uid 1000).

FROM node:22-bookworm-slim AS base
WORKDIR /app

# Dependências de produção. --ignore-scripts: nenhum pacote roda código na instalação
# (o sharp traz o binário pronto nos pacotes opcionais da plataforma).
FROM base AS dependencias
COPY servidor/package.json servidor/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM base AS build
COPY servidor/package.json servidor/package-lock.json ./
RUN npm ci --ignore-scripts
COPY servidor/tsconfig.json ./
COPY servidor/src ./src
RUN npx tsc

FROM base
# npm, npx, corepack e yarn não são usados em produção; sem eles, menos programas para explorar.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-* \
    && mkdir -p /app/estilos /dados/acervo \
    && chown node:node /dados/acervo
ENV NODE_ENV=production \
    PORTA=3000 \
    ESTILOS_DIR=/app/estilos \
    ACERVO_DIR=/dados/acervo
# O código pertence ao root: o processo lê, mas não altera.
COPY --from=dependencias /app/node_modules ./node_modules
COPY --from=build /app/dist/src ./dist
COPY servidor/package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
