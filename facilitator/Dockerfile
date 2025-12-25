# ==============================================================================
# Stage 1: Dependencies Installation
# ==============================================================================
FROM node:20-alpine AS deps

# Install pnpm
RUN npm install -g pnpm@10.7.0

WORKDIR /app

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy SDK packages and facilitator package.json
COPY typescript/packages ./typescript/packages
COPY facilitator/package.json ./facilitator/

# Install only the workspace packages needed for facilitator builds
RUN pnpm install --frozen-lockfile --filter "." --filter "@x402x/*"

# ==============================================================================
# Stage 2: Build
# ==============================================================================
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.7.0

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/typescript ./typescript
COPY --from=deps /app/facilitator/node_modules ./facilitator/node_modules

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy SDK source for building
COPY typescript/packages ./typescript/packages

# Copy facilitator source
COPY facilitator ./facilitator

# Build x402x SDK packages (required by facilitator)
RUN pnpm run build:sdk

# Build facilitator
RUN pnpm --filter='@x402x/facilitator' build

# ==============================================================================
# Stage 3: Production Runtime
# ==============================================================================
FROM node:20-alpine AS runner

# Install wget for health checks
RUN apk add --no-cache wget

# Install pnpm for production dependencies
RUN npm install -g pnpm@10.7.0

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy SDK packages with proper directory structure
# We need to copy each package's package.json AND dist directory separately
# to maintain the correct structure for facilitator dependencies
COPY --from=builder /app/typescript/packages/core/package.json ./typescript/packages/core/
COPY --from=builder /app/typescript/packages/core_v2/package.json ./typescript/packages/core_v2/
COPY --from=builder /app/typescript/packages/facilitator_v2/package.json ./typescript/packages/facilitator_v2/

# Copy facilitator package.json
COPY facilitator/package.json ./facilitator/

# Install production dependencies for facilitator and its SDK runtime
RUN pnpm install --frozen-lockfile --prod --filter "@x402x/*"

# Copy built SDK packages from builder (with correct directory structure)
COPY --from=builder /app/typescript/packages/core/dist ./typescript/packages/core/dist
COPY --from=builder /app/typescript/packages/core_v2/dist ./typescript/packages/core_v2/dist
COPY --from=builder /app/typescript/packages/facilitator_v2/dist ./typescript/packages/facilitator_v2/dist

# Copy built facilitator from builder
COPY --from=builder /app/facilitator/dist ./facilitator/dist
COPY --from=builder /app/facilitator/package.json ./facilitator/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S facilitator -u 1001

# Change ownership
RUN chown -R facilitator:nodejs /app

USER facilitator

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

# Start facilitator
WORKDIR /app/facilitator
CMD ["node", "dist/index.js"]
