FROM node:24-alpine
WORKDIR /app
RUN npm install -g pnpm@10.33.2
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
RUN pnpm --filter @zika/listing-service db:generate
RUN pnpm --filter @zika/listing-service build
EXPOSE 3003
CMD ["pnpm","--filter","@zika/listing-service","start"]
