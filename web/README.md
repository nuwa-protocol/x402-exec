# x402X Website

Official website for x402X (short for x402-exec): an extension to the x402 protocol that turns pay into pay-and-execute on any smart contract.

## Overview

- Problem: the current x402 protocol focuses on EOA to EOA payments. Agents can pay on behalf of users, but cannot atomically execute arbitrary on-chain actions tied to the payment.
- What we need: a way for a single x402 payment to also drive contract execution safely and atomically.
- What x402X enables: call and execute any smart contract as part of x402 payments. Agents can mint tokens and NFTs, execute DEX/SWAP trades, participate in token launches, and more. When we say agent, we mean it can even trade from real liquidity pools.

## Components

- Extension SDK: `@x402X` (drop-in replacement for current x402 SDK)
- Smart contract framework: programmable settlement router plus Hook interfaces
- Extended facilitator: multi-chain, incentivized settlement helper (we operate and host one)

## Facilitator and Networks

- Multi-chain rollout, starting with Base Sepolia testnet
- Want support for your chain or testnet? Open an issue in this repo and we can prioritize deployment

## Try It

- Testnet demo: coming soon (Base Sepolia). For now, see `examples/settlement-showcase` in the root repo for a local end-to-end demo
- Main repo: https://github.com/nuwa-protocol/x402-exec
- x402 background: https://github.com/coinbase/x402

## Develop (this website)

Prerequisites

- Node 20+
- pnpm

Install and run

```bash
pnpm install
pnpm dev
```

Build and preview

```bash
pnpm build
pnpm preview
```

Lint and format (Biome)

```bash
pnpm lint     # lint only
pnpm check    # lint + format check
pnpm format   # write fixes
```

## Notes

- This website is content/UI. Contracts and demos live under `../contracts` and `../examples/settlement-showcase`
- Tech stack: Vite + React + TypeScript + Tailwind v4
