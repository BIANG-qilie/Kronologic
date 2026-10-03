# Railway-oriented Next.js standalone image (Node 20).
# Prefer this over Nixpacks when edge still 502s after a correct bind.
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Standalone reads HOSTNAME as bind address. Force IPv4 0.0.0.0.
# Alpine [::] often sets IPV6_V6ONLY=1 → Railway IPv4 edge gets connection refused.
# Do not leave Docker's default container-id HOSTNAME in place.
ENV HOSTNAME=0.0.0.0
# Railway injects PORT at runtime; 3000 is only a local-docker default.
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# SQL migrations; applied on boot when DATABASE_URL is set (src/instrumentation.ts).
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs
# Port is whatever $PORT is at runtime — do not hard-require 3000.
CMD ["node", "server.js"]
