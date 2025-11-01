# Single-stage build for X402 Facilitator
# This approach keeps the workspace structure intact and avoids symlink issues
FROM node:20-alpine

# Install git for submodule support
RUN apk add --no-cache git

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

# Build the facilitator
RUN pnpm run build:facilitator

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

# Set working directory to facilitator
WORKDIR /app/examples/facilitator

# Add environment variable for Railway
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/supported', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"]
