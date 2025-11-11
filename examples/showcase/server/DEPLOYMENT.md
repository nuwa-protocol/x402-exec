# X402 Showcase Server Deployment Guide

## Overview

The showcase server is deployed using the shared Docker image `ghcr.io/nuwa-protocol/facilitator:latest`, which contains both the facilitator and showcase-server services. The service to run is controlled by the `SERVICE_NAME` environment variable.

## Railway Deployment

### Step 1: Create Service

1. Go to Railway Dashboard
2. Click "New Project" → "Deploy from Docker Image"
3. Enter image: `ghcr.io/nuwa-protocol/facilitator:latest`

### Step 2: Configure Environment Variables

Set the following environment variables in Railway:

**Required**:
- `SERVICE_NAME=showcase-server` - Tells the container to run the showcase server

**Conditionally Required** (depends on your setup):
- `FACILITATOR_URL` - URL of the facilitator service (e.g., `https://your-facilitator.railway.app`)

**Optional**:
- `PORT` - Port number (defaults to 3000)
- `NODE_ENV` - Environment mode (production, development)

### Step 3: Deploy

Railway will automatically pull and deploy the image. The service will start as the showcase-server based on the `SERVICE_NAME` environment variable.

## Docker Image Details

The Docker image is automatically built and pushed by GitHub Actions when:
- Code is pushed to the `main` branch
- Changes are made to `examples/facilitator/**`, `examples/showcase/server/**`, or `deps/x402/**`

**Image Registry**: `ghcr.io/nuwa-protocol/facilitator`

**Available Tags**:
- `latest` - Latest build from main branch
- `main-<git-sha>` - Specific commit from main branch
- `pr-<pr-number>` - Pull request builds (for testing)

## Local Development

For local development, you can use the workspace setup:

```bash
# Install dependencies
pnpm install

# Build x402 dependencies
pnpm run build:x402

# Build showcase server
pnpm run build:server

# Run locally
cd examples/showcase/server
FACILITATOR_URL=http://localhost:3002 pnpm start
```

## Local Docker Testing

You can test the Docker image locally:

```bash
# Build the image
docker build -f examples/facilitator/Dockerfile -t x402-services .

# Run showcase-server
docker run -p 3000:3000 \
  -e SERVICE_NAME=showcase-server \
  -e FACILITATOR_URL=http://your-facilitator-url \
  x402-services

# Or test facilitator
docker run -p 3000:3000 \
  -e SERVICE_NAME=facilitator \
  -e EVM_PRIVATE_KEY=your-key \
  x402-services
```

## API Endpoints

Once deployed, the showcase server provides:

- `GET /api/health` - Health check endpoint
- `POST /api/transfer-with-hook/payment` - Transfer with hook scenario
- `POST /api/referral-split/payment` - Referral split scenario
- `POST /api/nft-minting/payment` - NFT minting scenario
- `POST /api/reward-points/payment` - Points reward scenario
- `POST /api/purchase-download` - Premium download scenario

## Troubleshooting

### Service doesn't start

- Verify `SERVICE_NAME=showcase-server` is set correctly
- Check logs for any errors during startup
- Ensure `FACILITATOR_URL` points to a valid facilitator service

### Health check fails

- Verify the service is listening on the configured PORT
- Check that `/api/health` endpoint is accessible
- Review application logs for errors

### Connection to facilitator fails

- Verify `FACILITATOR_URL` is correctly set
- Ensure the facilitator service is running and accessible
- Check network connectivity between services
