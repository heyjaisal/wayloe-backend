FROM node:20-alpine AS base

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies layer (cached)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Production stage
FROM node:20-alpine AS production

RUN addgroup -g 1001 -S wayloe && \
    adduser -S wayloe -u 1001

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY package.json ./
COPY server.js ./
COPY config ./config
COPY middleware ./middleware
COPY models ./models
COPY controllers ./controllers
COPY services ./services
COPY routes ./routes
COPY utils ./utils

USER wayloe

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "server.js"]
