# Multi-stage Dockerfile for ComfortPay (Node 22 - slim)
# Builds the Next.js app then runs it with `next start`

# Stage 1 — builder
FROM node:22-slim AS builder
WORKDIR /app
ENV NODE_ENV=production

# Install build dependencies needed for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 git ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies (include dev deps for build)
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy source and build
COPY . .
RUN npm run build

# Stage 2 — runtime (HARDENED)
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only runtime dependencies (ca-certificates for HTTPS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy runtime artifacts from builder
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
# Copy entire src folder (needed for init-db.js, actions, API routes at runtime)
COPY --from=builder /app/src ./src

# Create writable cache directory for Next.js
RUN mkdir -p /app/.next/cache && chmod 777 /app/.next/cache

# Note: Running as root for faster builds. For production, uncomment non-root user below.
RUN addgroup --gid 1001 --system app && \
    adduser --uid 1001 --system --ingroup app app && \
    chown -R app:app /app
USER app

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

CMD ["npm", "run", "start"]
