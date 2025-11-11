# X402 Showcase Server Deployment Guide

## Overview

The showcase server handles Server Mode scenarios:
- **Premium Content Download**: Server-controlled payment verification and content delivery with static file serving

The server is deployed directly to Railway using Node.js (not Docker).

## Prerequisites

- Railway account
- GitHub repository (for automatic deployments)
- Environment variables configured

## Railway Deployment

### Step 1: Create New Service

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect the monorepo structure

### Step 2: Configure Build Settings

Railway uses `railway.toml` for build configuration. The file is located at `examples/showcase/server/railway.toml`:

```toml
providers = ["node"]

[phases.setup]
nixPkgs = ['nodejs', 'pnpm']

[phases.install]
cmds = [
  "pnpm install --frozen-lockfile"
]

[phases.build]
cmds = [
  "pnpm run build:server"
]

[start]
cmd = "cd examples/showcase/server && pnpm start"
```

**Important**: The build process does:
1. Compiles TypeScript (`tsc`)
2. Copies static files to `dist/static/` (for PDF downloads, etc.)

### Step 3: Configure Environment Variables

Set the following in Railway dashboard → Variables:

**Required**:
- `FACILITATOR_URL` - URL of your facilitator service (e.g., `https://your-facilitator.railway.app`)
- `DEFAULT_NETWORK` - Default blockchain network (e.g., `base-sepolia`, `xlayer-testnet`)
- `RESOURCE_SERVER_ADDRESS` - Your resource server wallet address
- `RESOURCE_SERVER_PRIVATE_KEY` - Private key for signing payment requirements

**Network-Specific** (at least one network required):
- `BASE_SEPOLIA_RPC_URL` - RPC endpoint for Base Sepolia
- `BASE_SEPOLIA_USDC_ADDRESS` - USDC token address
- `BASE_SEPOLIA_SETTLEMENT_ROUTER_ADDRESS` - Settlement router address
- `BASE_SEPOLIA_TRANSFER_HOOK_ADDRESS` - Transfer hook address

**Optional**:
- `PORT` - Port number (defaults to 3000)
- `NODE_ENV` - Environment mode (production recommended)

### Step 4: Deploy

Railway will automatically build and deploy when you push to your connected branch.

**Build Output**: The `dist/` directory contains:
- `dist/*.js` - Compiled JavaScript from TypeScript
- `dist/static/` - Static files (PDF, etc.) copied during build

## Static Files

The server serves static files (like PDFs) from the `static/` directory. During build:

```bash
pnpm run build
# Runs: tsc && pnpm run copy-static
# Creates: dist/static/x402-protocol-guide.pdf
```

**In Production**: Files are served from `dist/static/`  
**In Development**: Files are served from `server/static/`

The server automatically detects which location to use based on whether it's running from `dist/` or `src/`.

## Local Development

```bash
# From workspace root
pnpm install

# Build x402 SDK packages
pnpm run build:sdk

# Start server in dev mode (with hot reload)
cd examples/showcase/server
pnpm run dev

# Or build and run production mode
pnpm run build
pnpm start
```

## API Endpoints

Once deployed, the showcase server provides:

- `GET /api/health` - Health check endpoint
- `GET /api/scenarios` - List available scenarios
- `GET /api/premium-download/info` - Get premium content information
- `POST /api/purchase-download` - Purchase and get download link
- `GET /api/download/:contentId?token=xxx` - Download purchased content

## Troubleshooting

### Static files not found (404)

**Symptoms**: PDF downloads return 404 error

**Solutions**:
1. Verify build completed successfully: `pnpm run build`
2. Check `dist/static/` directory exists and contains files
3. Review server logs for file path errors
4. Ensure `copy-static` script runs after TypeScript compilation

### Service doesn't start

- Check all required environment variables are set
- Verify `FACILITATOR_URL` points to a valid facilitator service
- Review Railway logs for startup errors
- Ensure Node.js version is 20+

### Connection to facilitator fails

- Verify `FACILITATOR_URL` is correctly set
- Ensure the facilitator service is running and accessible
- Check network connectivity between services
- Test facilitator health endpoint: `curl $FACILITATOR_URL/health`

### Build fails on Railway

- Ensure monorepo structure is preserved
- Verify `pnpm-workspace.yaml` exists at repo root
- Check that SDK packages build successfully first
- Review build logs for missing dependencies

## Production Considerations

### Static File Storage

For production with many files or large files:
- Consider using cloud storage (S3, GCS, R2)
- Generate signed URLs with expiration
- Implement download tracking and analytics
- Add rate limiting for download endpoints

### Security

- Rotate `RESOURCE_SERVER_PRIVATE_KEY` regularly
- Use environment-specific keys (dev/staging/prod)
- Implement proper token validation for downloads
- Add request rate limiting
- Monitor for suspicious download patterns

### Monitoring

- Set up Railway logging and alerts
- Monitor download endpoint performance
- Track payment success/failure rates
- Monitor facilitator connectivity

## Migration Notes

This deployment guide reflects the current direct Railway deployment method. Previous documentation referenced a shared Docker image with `SERVICE_NAME` environment variable - that approach is not currently implemented.
