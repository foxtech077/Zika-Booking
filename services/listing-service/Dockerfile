FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY services/listing-service/package.json ./services/listing-service/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY packages/ ./packages/
COPY services/listing-service/ ./services/listing-service/
RUN pnpm --filter @zika/types build
RUN pnpm --filter @zika/validators build
RUN pnpm --filter @zika/listing-service build
RUN pnpm --filter @zika/listing-service exec prisma generate
WORKDIR /app/services/listing-service
EXPOSE 3003
CMD ["node", "dist/index.js"]
