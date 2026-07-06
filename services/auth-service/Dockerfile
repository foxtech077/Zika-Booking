FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
COPY services/auth-service/package.json ./services/auth-service/
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
RUN pnpm install --frozen-lockfile
COPY packages/ ./packages/
COPY services/auth-service/ ./services/auth-service/
RUN pnpm --filter @zika/types build
RUN pnpm --filter @zika/validators build
RUN pnpm --filter @zika/auth-service build
RUN pnpm --filter @zika/auth-service prisma generate
WORKDIR /app/services/auth-service
EXPOSE 3001
CMD ["node", "dist/index.js"]
