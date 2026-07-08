# ---- Stage 1: Install dependencies (rarely changes) ----
FROM node:24-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- Stage 2: Build shared + app ----
FROM deps AS build
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_API_URL
ARG NEXT_PUBLIC_LISTING_API_URL
ARG NEXT_PUBLIC_PAYMENT_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_API_URL=$NEXT_PUBLIC_AUTH_API_URL
ENV NEXT_PUBLIC_LISTING_API_URL=$NEXT_PUBLIC_LISTING_API_URL
ENV NEXT_PUBLIC_PAYMENT_API_URL=$NEXT_PUBLIC_PAYMENT_API_URL

RUN pnpm --filter @zika/types build && \
    pnpm --filter @zika/validators build && \
    pnpm --filter @zika/web build

# ---- Stage 3: Production image ----
FROM node:24-alpine AS production
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.mjs ./apps/web/
COPY --from=build /app/apps/web/package.json ./apps/web/
COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY --from=build /app/packages/types/package.json ./packages/types/
COPY --from=build /app/packages/validators/dist ./packages/validators/dist
COPY --from=build /app/packages/validators/package.json ./packages/validators/
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
