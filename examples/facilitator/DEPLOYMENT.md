# X402 Facilitator Deployment Guide

## 🐳 Docker Image Deployment

The facilitator is now deployed using pre-built Docker images for better reliability and faster deployments.

### Automatic Image Building

Docker images are automatically built and pushed to GitHub Container Registry when:
- Code is pushed to the `main` branch
- Pull requests are created (build-only, no push)

**Image Registry**: `ghcr.io/nuwa-protocol/x402-facilitator`

**Available Tags**:
- `latest` - Latest build from main branch
- `main-<git-sha>` - Specific commit from main branch
- `pr-<pr-number>` - Pull request builds (for testing)

### Railway Deployment

#### Step 1: Create Service
1. Go to Railway Dashboard
2. Click "New Project" → "Deploy from Docker Image"
3. Enter image: `ghcr.io/nuwa-protocol/x402-facilitator:latest`

#### Step 2: Configure Environment Variables
Set the following environment variables in Railway:

**Required**:
- `EVM_PRIVATE_KEY` - Your EVM private key for settlement

**Optional**:
- `SVM_PRIVATE_KEY` - Solana private key (if using Solana)
- `SVM_RPC_URL` - Custom Solana RPC URL
- `PORT` - Port number (defaults to 3000)

#### Step 3: Deploy
Railway will automatically pull and deploy the image.

### Local Development

For local development, you can still use the workspace setup:

```bash
# Install dependencies
pnpm install

# Build x402 dependencies
pnpm run build:x402

# Build facilitator
pnpm run build:facilitator

# Run locally
cd examples/facilitator
EVM_PRIVATE_KEY=your-key pnpm start
```

### Manual Docker Build

If you need to build the image manually:

```bash
# From project root
docker build -f examples/facilitator/Dockerfile -t x402-facilitator .

# Run locally
docker run -e EVM_PRIVATE_KEY=your-key -p 3000:3000 x402-facilitator
```

## 🔄 CI/CD Workflow

The GitHub Actions workflow (`.github/workflows/docker-facilitator.yml`) handles:

1. **On Pull Request**: Build image to verify it works
2. **On Push to Main**: Build and push image to registry
3. **Multi-platform**: Builds for both AMD64 and ARM64
4. **Caching**: Uses GitHub Actions cache for faster builds

## 🚀 Benefits

- ✅ **Version Control**: Exact git commit SHA in image tags
- ✅ **Fast Deployment**: No build time on Railway
- ✅ **Reliability**: Consistent build environment
- ✅ **Multi-platform**: Works on different architectures
- ✅ **Caching**: Faster subsequent builds
