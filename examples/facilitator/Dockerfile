# Multi-service Docker image for X402 services
# Supports both facilitator and showcase-server services via SERVICE_NAME environment variable
# This approach keeps the workspace structure intact and avoids symlink issues
FROM node:20-alpine

# Install git and wget for submodule support and health checks
RUN apk add --no-cache git wget

# Install pnpm
RUN npm install -g pnpm@10.7.0

# Set working directory
WORKDIR /app

# Copy the entire project (including local changes)
COPY . .

# Submodules should be initialized by CI checkout action

# Install all dependencies (including workspace dependencies)
RUN pnpm install --frozen-lockfile

# Build x402 dependencies first
RUN pnpm run build:x402

# Build both facilitator and showcase-server
RUN pnpm run build:facilitator
RUN pnpm run build:server

# Clean up unnecessary files to reduce image size
RUN rm -rf .git deps/x402/.git
RUN pnpm prune --prod
RUN rm -rf /root/.pnpm-store

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S facilitator -u 1001

# Change ownership of the app directory
RUN chown -R facilitator:nodejs /app
USER facilitator

# Set default service (facilitator for backward compatibility)
ENV SERVICE_NAME=facilitator
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check - service-aware
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD sh -c 'if [ "$SERVICE_NAME" = "showcase-server" ]; then \
      wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1; \
    else \
      wget -qO- http://localhost:${PORT:-3000}/supported || exit 1; \
    fi'

# Conditional startup based on SERVICE_NAME
CMD sh -c 'if [ "$SERVICE_NAME" = "showcase-server" ]; then \
      cd /app/examples/showcase/server && node dist/index.js; \
    else \
      cd /app/examples/facilitator && node dist/index.js; \
    fi'
