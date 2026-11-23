# Production image for the NestJS API. Build from the repo root:
#   docker build -f infrastructure/docker/api.Dockerfile -t quran-academy-api .

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-validation/package.json packages/shared-validation/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace @qa/api --include-workspace-root --ignore-scripts \
 && npx --workspace @qa/api prisma generate

FROM deps AS build
COPY packages packages
COPY apps/api apps/api
RUN npm run build -w @qa/config -w @qa/shared-types \
 && npm run build -w @qa/api \
 && npx --workspace @qa/api tsc -p tsconfig.seed.json \
 && npm prune --omit=dev --workspace @qa/api --include-workspace-root

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl tini && rm -rf /var/lib/apt/lists/* \
 && npm install -g prisma@6.19.3 && npm cache clean --force \
 && useradd --system --uid 1001 app
COPY --from=build --chown=app /repo/node_modules ./node_modules
COPY --from=build --chown=app /repo/packages ./packages
COPY --from=build --chown=app /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=app /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=app /repo/apps/api/seed-dist ./apps/api/seed-dist
COPY --from=build --chown=app /repo/apps/api/package.json ./apps/api/package.json
USER app
WORKDIR /repo/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
# Apply pending migrations, then start. (The Prisma CLI is a devDependency, so it is installed globally above.)
CMD ["sh", "-c", "prisma migrate deploy && node dist/main.js"]
