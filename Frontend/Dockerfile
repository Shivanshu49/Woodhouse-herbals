# syntax=docker/dockerfile:1
# Woodhouse Frontend (Next.js 14, output: 'standalone'). Multi-stage.

# ── Build ──
FROM node:20-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* are INLINED into the browser bundle at `next build`, so they must
# be passed as BUILD ARGS — a runtime env var is too late.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AI_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
# Fail LOUD if the critical one is missing — a silent http://localhost:4000
# fallback shipping to real customers' browsers is worse than a failed build.
RUN test -n "$NEXT_PUBLIC_API_URL" || { \
      echo "BUILD FAILED: --build-arg NEXT_PUBLIC_API_URL is required."; \
      echo "Without it the localhost fallback would be baked into the client bundle."; \
      exit 1; }
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_AI_URL=$NEXT_PUBLIC_AI_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime (standalone) ──
FROM node:20-slim AS runtime
WORKDIR /app
# HOSTNAME=0.0.0.0 is required: Next's standalone server.js binds to
# process.env.HOSTNAME, which Docker sets to the container id — without this it
# listens on the wrong interface and Traefik/health checks can't reach it.
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
# `output: standalone` emits a minimal server.js + traced node_modules; it does
# NOT include .next/static or public, so copy those alongside.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
# server.js honours the PORT env var. Coolify health probe: GET /
CMD ["node", "server.js"]
