FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY services/listing-service/package.json ./services/listing-service/
COPY services/listing-service/prisma ./services/listing-service/prisma/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY packages/ ./packages/
COPY services/listing-service/ ./services/listing-service/
RUN pnpm --filter @zika/types build
RUN pnpm --filter @zika/validators build
RUN pnpm --filter @zika/listing-service exec prisma generate
RUN pnpm --filter @zika/listing-service build
WORKDIR /app/services/listing-service
EXPOSE 3003
CMD ["node", "dist/index.js"]
