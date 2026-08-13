# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.33.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY services/auth-service/package.json ./services/auth-service/
COPY services/auth-service/prisma ./services/auth-service/prisma/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts --filter @zika/auth-service... --store-dir /pnpm/store
COPY packages/ ./packages/
COPY services/auth-service/ ./services/auth-service/
RUN pnpm --filter @zika/types build
RUN pnpm --filter @zika/validators build
RUN cd services/auth-service && npx prisma generate
RUN pnpm --filter @zika/auth-service build

# ── Runtime stage — production deps + built artifacts only ───────────────────
FROM node:24-alpine
WORKDIR /app
RUN npm install -g pnpm@10.33.2
# Workspace manifests only (tiny) so pnpm can resolve the filtered install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
COPY apps/mobile/package.json ./apps/mobile/
COPY services/auth-service/package.json ./services/auth-service/
COPY services/listing-service/package.json ./services/listing-service/
COPY services/payment-service/package.json ./services/payment-service/
# Production deps only — build tooling (typescript, tsx, @types) stays in the
# builder. `prisma` is a runtime dependency: the container runs
# db:migrate:deploy on start, and CI runs `docker compose run ... prisma
# migrate deploy` against this same image.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts --prod --filter @zika/auth-service... --store-dir /pnpm/store
# Built workspace packages (dist) + service build output + prisma migrations
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/validators/dist ./packages/validators/dist
COPY --from=builder /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=builder /app/services/auth-service/prisma ./services/auth-service/prisma
WORKDIR /app/services/auth-service
EXPOSE 3001
CMD ["sh", "-c", "pnpm db:migrate:deploy && node dist/index.js"]
