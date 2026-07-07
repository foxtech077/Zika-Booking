FROM node:24-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

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
RUN pnpm --filter @zika/web build
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
