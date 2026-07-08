# ---- Stage 1: Install dependencies (rarely changes) ----
FROM node:24-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY services/payment-service/package.json ./services/payment-service/
COPY services/payment-service/prisma ./services/payment-service/prisma/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- Stage 2: Build shared + service (changes more often) ----
FROM deps AS build
COPY packages/ ./packages/
COPY services/payment-service/ ./services/payment-service/
RUN pnpm --filter @zika/types build && \
    pnpm --filter @zika/validators build && \
    cd services/payment-service && npx prisma generate && \
    pnpm --filter @zika/payment-service build

# ---- Stage 3: Production image ----
FROM node:24-alpine AS production
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY --from=build /app/packages/types/package.json ./packages/types/
COPY --from=build /app/packages/validators/dist ./packages/validators/dist
COPY --from=build /app/packages/validators/package.json ./packages/validators/
COPY --from=build /app/services/payment-service/dist ./services/payment-service/dist
COPY --from=build /app/services/payment-service/prisma ./services/payment-service/prisma
COPY --from=build /app/services/payment-service/package.json ./services/payment-service/
WORKDIR /app/services/payment-service
EXPOSE 3004
CMD ["node", "dist/index.js"]
