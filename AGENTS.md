# Repository Guidelines

## Project Structure

This repository is a pnpm workspace containing Solidity contracts, a TypeScript SDK, and runnable services/apps:

- `contracts/`: Foundry project (Solidity)
  - `contracts/src/` core contracts, `contracts/test/` Foundry tests, `contracts/script/` deploy scripts, `contracts/examples/` hook examples
- `typescript/packages/*`: SDK/workspace packages (core, client, react, hono/express adapters)
- `facilitator/`: production facilitator service (Node/TS)
- `examples/showcase/{server,client}/`: full-stack demo
- `web/{frontend,backend}/`: scanner/web UI and backend
- `docs/`, `scripts/`: documentation and helper scripts
- `deps/`, `contracts/lib/`, `lib/`: git submodules (avoid editing directly; update via submodule bump)

## Setup

- Initialize dependencies and submodules: `git submodule update --init --recursive`
- Install JS deps (Node >=18; `web/frontend` expects Node >=20): `pnpm install`
- Configuration: start from `env.template` → `.env` (RPC URLs, API keys). Never commit secrets.

## Build, Test, and Development Commands

- Workspace build: `pnpm build` (SDK + examples + facilitator)
- Format (SDK packages): `pnpm format` / `pnpm format:check`
- Showcase dev: `pnpm dev` (runs the showcase app)
- Contracts: `cd contracts && forge build && forge test` (use `forge coverage` for coverage)
- Deploy contracts: `cd contracts && ./deploy-contract.sh [NETWORK] ...` (requires `.env`)
- Facilitator: `pnpm -C facilitator dev` / `pnpm -C facilitator test`
- Web apps: `pnpm -C web/frontend dev` and `pnpm -C web/backend dev`

## Coding Style & Naming

- TypeScript: format with Prettier (`typescript/.prettierrc`, `facilitator/.prettierrc`; 2-space indent, ~100 columns). Prefer `*.test.ts` for tests.
- Web frontend: uses Biome (`web/frontend/biome.json`) for linting and formatting (`pnpm -C web/frontend check`).
- Solidity: keep `pragma solidity ^0.8.20`, use NatSpec on public/external APIs, and follow CEI/reentrancy-safe patterns.

## Testing Guidelines

- Solidity (Foundry): tests live in `contracts/test/*.t.sol`. Include revert/edge cases; run `forge test --gas-report` for contract-impacting changes.
- TypeScript (Vitest): used across packages and `facilitator/`. Example: `pnpm --filter @x402x/core test` or `pnpm -C facilitator test:coverage`.

## Commit & Pull Request Guidelines

- Commits generally follow conventional commits (e.g., `feat: ...`, `fix: ...`, `docs: ...`); add a scope when helpful (`feat(facilitator): ...`).
- PRs should include: summary, linked issue(s), how to test, and any required config/deploy notes. For contract changes, include `forge test` results and note any gas-sensitive changes.
