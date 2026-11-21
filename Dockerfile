FROM node:22-slim AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/game-core/package.json packages/game-core/
COPY packages/rpc-sdk/package.json packages/rpc-sdk/
COPY packages/monster-ui/package.json packages/monster-ui/
COPY packages/snes-games/package.json packages/snes-games/
COPY apps/server/package.json apps/server/
COPY apps/web-companion/package.json apps/web-companion/
COPY apps/handheld-sim/package.json apps/handheld-sim/

RUN npm install

COPY scripts ./scripts
COPY packages ./packages
COPY apps ./apps

RUN npm run typecheck && npm test && npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

COPY --from=builder /app/package.json ./
COPY --from=builder /app/scripts/link-workspaces.mjs ./scripts/link-workspaces.mjs
COPY --from=builder /app/packages/game-core/package.json ./packages/game-core/
COPY --from=builder /app/packages/game-core/dist ./packages/game-core/dist
COPY --from=builder /app/packages/rpc-sdk/package.json ./packages/rpc-sdk/
COPY --from=builder /app/packages/rpc-sdk/dist ./packages/rpc-sdk/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web-companion/dist ./apps/web-companion/dist
COPY --from=builder /app/apps/handheld-sim/dist ./apps/handheld-sim/dist

RUN node scripts/link-workspaces.mjs && mkdir -p /app/data/uploads
EXPOSE 3000

CMD ["node", "apps/server/dist/server.js"]
