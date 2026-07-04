# Unitik-Cob API — Node.js 20 LTS (mandatory stack)
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter @unitik/api --filter @unitik/shared-types

FROM deps AS build
COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
RUN pnpm --filter @unitik/api prisma:generate && pnpm --filter @unitik/api build

FROM base AS runtime
ENV NODE_ENV=production TZ=America/Bogota
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/prisma ./apps/api/prisma
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
