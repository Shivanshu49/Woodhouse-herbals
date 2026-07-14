# syntax=docker/dockerfile:1
# Woodhouse Backend (NestJS + Prisma). Multi-stage.
# Boot order note: the app runs a boot-time gate that exit(1)s in production if
# the money-critical partial indexes are absent. Coolify 4.1.2 has NO
# pre-deployment command field, so `start:prod` runs `prisma migrate deploy`
# before the app — a failed migrate exits non-zero and the app never boots.
# See docs/DEPLOY-COOLIFY.md.

# ── Build: install deps (postinstall runs `prisma generate`) + nest build ──
FROM node:20-slim AS build
WORKDIR /app
# Prisma's query engine needs OpenSSL (generate + runtime).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
# Copy the manifest AND prisma/ BEFORE `npm ci`, so the postinstall
# `prisma generate` can find prisma/schema.prisma and generate the client.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
# App source, then compile (nest build → dist/src/main.js).
COPY . .
RUN npm run build

# ── Runtime ──
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
# Keep the FULL node_modules: the Prisma CLI is a devDependency and
# `start:prod` runs `prisma migrate deploy` in THIS image — do NOT prune it.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
EXPOSE 4000
# Health probe (Coolify): /api/health  — do NOT use /api/health/ready (returns
# 200 even when the DB is down). See docs/DEPLOY-COOLIFY.md.
# start:prod = `prisma migrate deploy && NODE_ENV=production node dist/src/main.js`
# — migrations gate the boot; a failed migrate stops the container (fail-loud).
CMD ["npm", "run", "start:prod"]
