FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY services/payment-service/package.json ./services/payment-service/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY packages/ ./packages/
COPY services/payment-service/ ./services/payment-service/
RUN pnpm --filter @zika/types build
RUN pnpm --filter @zika/validators build
RUN pnpm --filter @zika/payment-service build
RUN pnpm --filter @zika/payment-service exec prisma generate
WORKDIR /app/services/payment-service
EXPOSE 3004
CMD ["node", "dist/index.js"]
