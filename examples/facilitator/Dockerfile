# Multi-stage build for X402 Facilitator
FROM node:20-alpine AS builder

# Install git for submodule support
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Clone the repository with submodules
ARG GITHUB_TOKEN
RUN git clone --recursive https://github.com/nuwa-protocol/x402-exec.git .

# Install pnpm
RUN npm install -g pnpm@10.7.0

# Install all dependencies (including workspace dependencies)
RUN pnpm install --frozen-lockfile

# Build x402 dependencies first
RUN pnpm run build:x402

# Build the facilitator
RUN pnpm run build:facilitator

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy the entire built workspace structure to preserve links
COPY --from=builder /app/examples/facilitator ./
COPY --from=builder /app/deps/x402/typescript/packages ./node_modules/

# No need to install dependencies - everything is already built and linked

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S facilitator -u 1001

# Change ownership of the app directory
RUN chown -R facilitator:nodejs /app
USER facilitator

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/supported', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"]
