# syntax=docker/dockerfile:1
# Woodhouse Admin (Next.js 14, output: 'standalone'). Multi-stage.

# ── Build ──
FROM node:20-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* are inlined at `next build` — pass them as BUILD ARGS.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
# Fail LOUD if the API URL is missing — a silent localhost fallback baked into
# the admin bundle would point staff at a dead API in production.
RUN test -n "$NEXT_PUBLIC_API_URL" || { \
      echo "BUILD FAILED: --build-arg NEXT_PUBLIC_API_URL is required."; \
      echo "Without it the localhost fallback would be baked into the client bundle."; \
      exit 1; }
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime (standalone) ──
FROM node:20-slim AS runtime
WORKDIR /app
# Default 3001 (matches local dev); server.js honours PORT if Coolify overrides it.
# HOSTNAME=0.0.0.0 is required: Next standalone binds to process.env.HOSTNAME
# (Docker sets it to the container id) — without this Traefik can't reach it.
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
# curl: Coolify executes its health probe INSIDE the container, and
# node:20-slim ships neither curl nor wget — without it the probe fails and
# Coolify rolls back an otherwise healthy deploy.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3001
# Coolify health probe: GET /
CMD ["node", "server.js"]
