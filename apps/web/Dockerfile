FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
RUN pnpm install --frozen-lockfile
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
RUN pnpm --filter @zika/types build
RUN pnpm --filter @zika/validators build
RUN pnpm --filter @zika/web build
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
