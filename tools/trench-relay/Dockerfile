# TRENCHING SIMULATOR's Live mode relay (2026-10-21, #404): its image, on the owner's server beside her live show. Node
# and the relay's two packages (ws, sharp), run as the image's own user (never root). Its settings (the Helius key) come
# from /opt/agi1-trench/trench.env when it runs, never from here:
#   sh tools/trench-relay/relay.sh update   git pull, then: docker build -t agi1-trench tools/trench-relay
#   sh tools/trench-relay/relay.sh start    docker run … --env-file /opt/agi1-trench/trench.env agi1-trench (and Caddy)
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.mjs ./
COPY lib ./lib

# never root
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server.mjs"]
