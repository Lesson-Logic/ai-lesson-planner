# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ── Stage 2: builder ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pass the API key at build time: docker build --build-arg OPENROUTER_API_KEY=sk-...
# This keeps the secret out of the Dockerfile source (and git history).
ARG OPENROUTER_API_KEY
ENV OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: runner ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The API key is carried from the builder stage into the runtime image
ARG OPENROUTER_API_KEY
ENV OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
# Default port; override at runtime with -e PORT=xxxx
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy only the standalone output and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static   ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public         ./public

USER nextjs

EXPOSE 3001

# standalone outputs a server.js at the root
CMD ["node", "server.js"]
