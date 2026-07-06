FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY packages/ ./packages/
COPY apps/admin/ ./apps/admin/
RUN pnpm --filter @zika/types build
RUN pnpm --filter @zika/validators build
RUN pnpm --filter @zika/admin build
WORKDIR /app/apps/admin
EXPOSE 3002
CMD ["pnpm", "start", "-p", "3002"]
