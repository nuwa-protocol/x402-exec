# Development Guide

This document describes how to develop and deploy the X402 Settlement project locally.

## Table of Contents

- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Submodule Management](#submodule-management)
- [Development Workflow](#development-workflow)
- [Build and Deployment](#build-and-deployment)
- [Troubleshooting](#troubleshooting)

## Project Structure

```
x402_settle/
├── deps/
│   └── x402/                  # Git Submodule: x402 protocol implementation
├── examples/
│   ├── showcase/               # Showcase example application
│   │   ├── client/           # Frontend application
│   │   └── server/           # Backend service
│   └── facilitator/          # Facilitator example
├── contracts/                # Smart contracts
├── scripts/                  # Build and deployment scripts
├── pnpm-workspace.yaml       # pnpm workspace configuration
└── package.json              # Root package.json
```

## Requirements

- **Node.js**: >= 20.0.0
- **pnpm**: >= 10.7.0
- **Git**: >= 2.13.0 (with submodule support)

### Install pnpm

```bash
npm install -g pnpm@10.7.0
```

## Quick Start

### 1. Clone the Project

```bash
# Clone the main repository
git clone https://github.com/nuwa-protocol/x402_settle.git
cd x402_settle

# Initialize submodules (Important!)
git submodule update --init --recursive
```

### 2. Install Dependencies

```bash
# Run in the project root directory
pnpm install
```

This will automatically install all dependencies in the workspace, including:
- Dependencies for deps/x402
- Dependencies for examples/showcase/server
- Dependencies for examples/showcase/client

### 3. Local Development

#### Developing Client and Server

```bash
# Start both client and server (recommended)
pnpm run dev

# Or start them separately
pnpm run dev:client  # Start frontend, default http://localhost:5173
pnpm run dev:server  # Start backend, default http://localhost:3000
```

#### Developing Client Only

```bash
cd examples/showcase/client
pnpm run dev
```

#### Developing Server Only

```bash
cd examples/showcase/server
pnpm run dev
```

## Submodule Management

This project uses Git Submodule to manage the x402 dependency.

### Check Submodule Status

```bash
git submodule status
```

### Update Submodule to Latest Version

```bash
# Update to the latest commit from remote
cd deps/x402
git pull origin main  # or your branch name
cd ../..
git add deps/x402
git commit -m "chore: update x402 to latest"
```

### Switch to a Specific x402 Version

```bash
cd deps/x402
git checkout <commit-hash>  # or branch-name or tag
cd ../..
git add deps/x402
git commit -m "chore: pin x402 to <version>"
```

### Modify x402 Code

If you need to modify x402 code:

```bash
# 1. Enter the submodule
cd deps/x402

# 2. Create a new branch
git checkout -b feature/your-feature

# 3. Make changes and commit
git add .
git commit -m "feat: your changes"

# 4. Push to x402 repository
git push origin feature/your-feature

# 5. Return to main project and update submodule reference
cd ../..
git add deps/x402
git commit -m "chore: update x402 to feature/your-feature"

# 6. Create a Pull Request in the x402 repository
```

## Development Workflow

### Standard Development Process

1. **Pull Latest Code**
   ```bash
   git pull
   git submodule update --init --recursive
   pnpm install
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature
   ```

3. **Develop and Test**
   ```bash
   pnpm run dev  # Local development
   ```

4. **Build Verification**
   ```bash
   ./scripts/deploy-showcase.sh --all
   ```

5. **Commit Code**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature
   ```

6. **Create Pull Request**

### Dependency Updates

#### Update x402 Dependency

```bash
cd deps/x402
git pull origin main
cd ../..
git add deps/x402
git commit -m "chore: update x402"
```

#### Update npm Package Dependencies

```bash
# Update a specific package
pnpm update <package-name>

# Update all packages
pnpm update

# Update and modify package.json
pnpm update <package-name> --latest
```

## Build and Deployment

### Using Build Scripts

We provide unified build scripts:

```bash
# Build everything (x402 + server + client)
./scripts/deploy-showcase.sh --all

# Build only x402 dependency
./scripts/deploy-showcase.sh --x402

# Build server (includes x402)
./scripts/deploy-showcase.sh --server

# Build client (includes x402)
./scripts/deploy-showcase.sh --client

# Clean build artifacts
./scripts/deploy-showcase.sh --clean
```

### Manual Build

```bash
# Build x402
cd deps/x402/typescript
pnpm run build

# Build server
cd examples/showcase/server
pnpm run build

# Build client
cd examples/showcase/client
pnpm run build
```

### Cloud Deployment

Detailed deployment documentation:

- **Client (Cloudflare Pages)**: See `examples/showcase/client/CLOUDFLARE_DEPLOY.md`
- **Server (Railway)**: See `examples/showcase/server/RAILWAY_DEPLOY.md`
- **Vercel (Alternative)**: See `VERCEL_DEPLOY.md` in the root directory

Deployment key points:
1. Ensure cloud services can access your Git repository
2. Build commands must include `git submodule update --init --recursive`
3. Configure correct environment variables

## Troubleshooting

### Q1: Submodule is Empty or Not Initialized

**Issue**: After cloning the project, the `deps/x402` directory is empty

**Solution**:
```bash
git submodule update --init --recursive
```

### Q2: Dependency Installation Failed

**Issue**: `pnpm install` reports an error

**Solution**:
```bash
# Clean and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

### Q3: x402 Package Not Found

**Issue**: Runtime error indicating x402 or x402-fetch cannot be found

**Solution**:
```bash
# Ensure x402 is built
cd deps/x402/typescript
pnpm run build
cd ../../..

# Reinstall dependencies
pnpm install
```

### Q4: x402 Changes Not Taking Effect in Local Development

**Issue**: Modified x402 code but changes don't appear in the application

**Solution**:
```bash
# Rebuild x402
cd deps/x402/typescript
pnpm run build
cd ../../..

# Restart development server
pnpm run dev
```

### Q5: Cloud Deployment Failed

**Issue**: Build fails when deploying to cloud services

**Possible Causes and Solutions**:
1. **Submodule not initialized**: Ensure build commands include `git submodule update --init --recursive`
2. **Permission issues**: Ensure cloud services have permission to access the submodule repository
3. **Node version**: Ensure environment variable `NODE_VERSION=20` is set
4. **pnpm version**: Ensure environment variable `PNPM_VERSION=10.7.0` is set

### Q6: How to Debug Build Issues

```bash
# Use build script with detailed output
./scripts/deploy-showcase.sh --all

# Or manually build step by step
git submodule update --init --recursive
pnpm install --frozen-lockfile
cd deps/x402/typescript && pnpm run build
cd ../../..
cd examples/showcase/server && pnpm run build
cd ../../..
cd examples/showcase/client && pnpm run build
```

## Getting Help

- If you encounter issues, please create an Issue in the project
- Check related documentation:
  - [X402 Protocol Documentation](https://github.com/nuwa-protocol/x402)
  - [Settlement Contract Documentation](./contracts/docs/)

## Team Collaboration Best Practices

1. **Regular Sync**: Pull latest code and update submodules at the start of each day
2. **Independent Branches**: Create separate branches for each feature
3. **Commit Standards**: Use semantic commit messages (feat/fix/chore/docs, etc.)
4. **Test Verification**: Ensure local builds succeed before committing
5. **Code Review**: Create PRs and wait for team member reviews
