# X402 Showcase Client Deployment Guide

## Overview

The showcase client is a React application that can be deployed to Cloudflare Pages or any static hosting service. It communicates with the showcase server via API calls.

## Configuration

### Environment Variables

The client uses environment variables to configure the backend server URL:

**`VITE_SERVER_URL`** (Optional)

- **Development**: Leave unset to use Vite's dev proxy (automatically proxies to `localhost:3001`)
- **Production**: Set to your deployed showcase server URL

Example values:

```bash
# Production (Cloudflare Pages, Netlify, Vercel, etc.)
VITE_SERVER_URL=https://x402-showcase-server.railway.app

# Same-origin deployment (client and server on same domain)
# Leave unset or empty
VITE_SERVER_URL=
```

## Deployment Options

### Option 1: Cloudflare Pages (Recommended)

#### Step 1: Connect Repository

1. Go to [Cloudflare Pages Dashboard](https://dash.cloudflare.com/pages)
2. Click "Create a project" → "Connect to Git"
3. Select your repository

#### Step 2: Configure Build Settings

**Build Configuration**:

- **Framework preset**: None
- **Build command**: `git submodule update --init --recursive && pnpm install --frozen-lockfile && pnpm run build:client`
- **Build output directory**: `examples/showcase/client/dist`
- **Root directory**: `/` (repository root)

**Environment Variables** (in Cloudflare Pages dashboard):

```
NODE_VERSION = 20
PNPM_VERSION = 10.7.0
VITE_SERVER_URL = https://your-showcase-server.railway.app
```

#### Step 3: Deploy

Cloudflare Pages will automatically build and deploy your application.

**Custom Domain** (Optional):

- Go to your Pages project → Custom domains
- Add your domain (e.g., `showcase.x402.org`)
- Follow DNS configuration instructions

### Option 2: Same-Origin Deployment

If you want to deploy the client and server on the same domain:

1. **Deploy server** to a platform that supports static file serving (e.g., Railway with static files)
2. **Build client**: `pnpm run build:client`
3. **Copy client files** to server's public directory
4. **Leave `VITE_SERVER_URL` unset** - the client will use relative paths

Example with Express/Hono server:

```typescript
// Serve client files
app.use(express.static('public'));

// API routes
app.get('/api/health', ...);
app.post('/api/transfer-with-hook/payment', ...);
```

### Option 3: Vercel

**vercel.json** in repository root:

```json
{
  "buildCommand": "cd examples/showcase/client && pnpm install && pnpm run build",
  "outputDirectory": "examples/showcase/client/dist",
  "installCommand": "pnpm install",
  "framework": "vite",
  "env": {
    "VITE_SERVER_URL": "https://your-showcase-server.railway.app"
  }
}
```

Deploy:

```bash
vercel --prod
```

### Option 4: Netlify

**netlify.toml** in repository root:

```toml
[build]
  command = "git submodule update --init --recursive && pnpm install --frozen-lockfile && pnpm run build:client"
  publish = "examples/showcase/client/dist"

[build.environment]
  NODE_VERSION = "20"
  VITE_SERVER_URL = "https://your-showcase-server.railway.app"
```

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 10.7.0+

### Setup

```bash
# Install dependencies (from repo root)
pnpm install

# Initialize submodules
git submodule update --init --recursive

# Build x402 dependencies
pnpm run build:x402

# Start development server
cd examples/showcase/client
pnpm run dev
```

The dev server will run on `http://localhost:5173` and automatically proxy API requests to `http://localhost:3001`.

### Development Environment

Create a `.env` file in the client directory (optional, for local development):

```bash
# .env (local development)
# Leave empty to use Vite proxy
VITE_SERVER_URL=
```

## Configuration Flow

### Development Mode (Vite Dev Server)

```
Browser → http://localhost:5173/api/health
         ↓ (Vite proxy)
         → http://localhost:3001/api/health (showcase server)
```

### Production Mode (with VITE_SERVER_URL)

```
Browser → https://showcase.x402.org
         ↓ (JavaScript fetch)
         → https://server.railway.app/api/health
```

### Production Mode (same-origin)

```
Browser → https://showcase.x402.org/api/health
         ↓ (relative path)
         → https://showcase.x402.org/api/health (same server)
```

## Troubleshooting

### CORS Errors in Production

**Problem**: Browser console shows CORS errors when calling API

**Solution**: Configure CORS on the showcase server to allow your client domain:

```typescript
// In showcase server
app.use(
  cors({
    origin: ["https://your-client-domain.pages.dev", "https://showcase.x402.org"],
  }),
);
```

### API Calls Return 404

**Problem**: API endpoints return 404 Not Found

**Solutions**:

1. Verify `VITE_SERVER_URL` is set correctly in production
2. Check that server is running and accessible
3. Verify server URL is accessible from your browser
4. Check server logs for errors

### Build Fails on Cloudflare Pages

**Problem**: Build fails with submodule or dependency errors

**Solutions**:

1. Verify git submodules are configured correctly
2. Check that build command includes `git submodule update --init --recursive`
3. Verify `NODE_VERSION` and `PNPM_VERSION` are set in environment variables
4. Check build logs for specific error messages

### Environment Variable Not Working

**Problem**: `VITE_SERVER_URL` is not being used

**Solutions**:

1. Verify the variable is prefixed with `VITE_` (required by Vite)
2. Check that the variable is set in the hosting platform's dashboard
3. Rebuild and redeploy after setting environment variables
4. Check browser console for the actual URL being called

## Testing Production Build Locally

```bash
# Build production bundle
pnpm run build

# Preview production build
pnpm run preview
```

The preview server will run on `http://localhost:4173`.

To test with production server URL:

```bash
# Set environment variable for build
VITE_SERVER_URL=https://your-server.railway.app pnpm run build
pnpm run preview
```

## Monitoring

### Health Check

After deployment, verify the client can reach the server:

1. Open browser console on your deployed client
2. Make a payment or click a scenario button
3. Check console logs for API request URLs
4. Verify requests are going to the correct server URL

### Debug Mode

The client includes detailed console logging for the payment flow:

- Step-by-step payment process
- API request/response details
- Commitment calculation
- Signature generation

Enable browser console to see these logs during development and testing.
