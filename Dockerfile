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

# Stage 2 — runtime
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy runtime artifacts from builder
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
# Copy source files (needed by runtime code that reads files from disk)
# COPY --from=builder /app/src ./src

# Create a non-root user for running the app
RUN addgroup --system app && adduser --system --ingroup app app || true
# Ensure the runtime user owns the application files and cache directories
# RUN chown -R app:app /app
USER app

EXPOSE 3000
CMD ["npm", "run", "start"]
