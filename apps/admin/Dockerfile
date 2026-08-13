# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.33.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY apps/admin/package.json ./apps/admin/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts --filter @zika/admin... --store-dir /pnpm/store
COPY packages/ ./packages/
COPY apps/admin/ ./apps/admin/

# NEXT_PUBLIC_* vars are inlined at build time by Next.js. The .env file is
# gitignored and excluded by .dockerignore, so they must be injected here as
# build args or the client bundle falls back to the same-origin URL.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_API_URL
ARG NEXT_PUBLIC_LISTING_API_URL
ARG NEXT_PUBLIC_PAYMENT_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_API_URL=$NEXT_PUBLIC_AUTH_API_URL
ENV NEXT_PUBLIC_LISTING_API_URL=$NEXT_PUBLIC_LISTING_API_URL
ENV NEXT_PUBLIC_PAYMENT_API_URL=$NEXT_PUBLIC_PAYMENT_API_URL

RUN pnpm --filter @zika/types build
RUN pnpm --filter @zika/validators build
RUN pnpm --filter @zika/admin build

# ── Runtime stage — production deps + compiled .next only ────────────────────
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
# Production deps only — next/react + runtime libs (all in `dependencies`);
# build tooling (typescript, tailwind, postcss, ...) stays in the builder.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts --prod --filter @zika/admin... --store-dir /pnpm/store
# Compiled app + static assets + config; drop the webpack build cache (it is
# the bulk of .next and is not needed by `next start`)
COPY --from=builder /app/apps/admin/.next ./apps/admin/.next
COPY --from=builder /app/apps/admin/public ./apps/admin/public
COPY --from=builder /app/apps/admin/next.config.mjs ./apps/admin/
RUN rm -rf apps/admin/.next/cache
WORKDIR /app/apps/admin
EXPOSE 3002
CMD ["pnpm", "start", "-p", "3002"]
