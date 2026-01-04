# x402x Docs Skill

Use this skill to help Codex/Claude integrate or reason about the x402x protocol (programmable x402 settlement) across clients, servers, hooks, fees, and migrations.

## Core Concepts
- x402x = atomic pay-and-execute: client signs EIP-3009 authorization; facilitator calls `SettlementRouter` which verifies and executes a Hook; native facilitator fee support.
- Key terms: `SettlementRouter` hub, `ISettlementHook` contract, commitment-as-nonce (hash of settlement params becomes the EIP-3009 nonce), `PaymentRequirements.extra` carries settlement fields (router, salt, payTo, fee, hook, hookData).
- x402 compatibility: if `extra.settlementRouter` missing, behaves like standard x402 (random nonce, `to = payTo`).

## Integration Modes
- Mode A: Server-Validated — backend returns 402; client signs and retries; server verifies via facilitator. Best for APIs/premium content.
- Mode B: Serverless — browser calls facilitator directly; good for static sites/dapps.

## Client Usage
- Install: `@x402x/client @x402x/extensions @x402/fetch @x402/core viem` (pnpm/npm/yarn/bun).
- Mode A (server-validated): create signer, `x402Client`, `registerX402xScheme(client, "eip155:84532", signer)`, wrap fetch with `wrapFetchWithPayment`; 402 handled automatically.
- Mode B (serverless): `new x402xClient({ wallet, network, facilitatorUrl })`; call `execute({ amount, payTo, hook?, hookData?, facilitatorFee? })`; supports revenue splits via `TransferHook.encode`.
- React hook: `useX402xClient` to get client and call `execute`.
- Low-level primitives: `prepareSettlement`, `signAuthorization`, `settle(facilitatorUrl, signed)` for full control.
- CORS: configure facilitator `CORS_ORIGIN` when called from browsers.

## Server Usage (Hono)
- Install: `@x402/hono @x402/evm @x402x/extensions`.
- Setup: create `x402ResourceServer` with `HTTPFacilitatorClient`; `registerExactEvmScheme(server, {})`; `registerRouterSettlement(server)`; `await server.initialize()`.
- Routes: use `createSettlementRouteConfig({...}, { hook, hookData, facilitatorFee? })` (supports network aliases like `base-sepolia`); apply `paymentMiddleware(routes, server)`.
- Express: pending; follow similar pattern with `@x402/express` + extension registration.

## Facilitator Fees
- Purpose: cover gas, ensure facilitator sustainability, enable permissionless operation.
- Calculation factors: gas price, hook complexity, safety/profit margins.
- Flow: user signs total (business + fee) → router deducts fee → hook receives business amount → fee accumulates for facilitator claims.
- Client: fee auto-queried by default; optional `calculateFee(hook, hookData)` for manual/UX control; pass `facilitatorFee` to `execute`.
- Server: middleware can use `facilitatorFee: "auto"` or fixed values (e.g., `"$0.01"`); fee endpoint `GET /calculate-fee?network=...&hook=...&hookData=...`.
- Best practice: query close to payment time; prefer automatic queries for changing gas.

## Hooks
- Interface `execute(bytes32 contextKey, address payer, address token, uint256 amount, bytes32 salt, address payTo, address facilitator, bytes calldata data) returns (bytes)`.
- Rules: callable only by router; consume full `amount`; deterministic logic; revert aborts settlement; use params for transparency.
- Template: store `hub` address, `onlyHub` modifier, transfer from hub to recipient decoded from `data`.
- Built-in `TransferHook`: one per network; `getAddress(network)`; `encode()` for simple transfer or `encode([{recipient,bips}, ...])` for splits.
- Examples live under `contracts/examples/` (TransferHook, NFTMintHook, RewardHook).

## Networks & Addresses (SettlementRouter / TransferHook)
- Base Sepolia: 0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb / 0x4DE234059C6CcC94B8fE1eb1BD24804794083569
- X-Layer Testnet: 0xba9980fb08771e2fd10c17450f52d39bcb9ed576 / 0xD4b98dd614c1Ea472fC4547a5d2B93f3D3637BEE
- Base mainnet: 0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B / 0x081258287F692D61575387ee2a4075f34dd7Aef7
- X-Layer mainnet: 0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B / 0x081258287F692D61575387ee2a4075f34dd7Aef7
- Programmatic access: `getNetworkConfig(network)` from `@x402x/core`.

## Packages
- `@x402x/extensions`: hook helpers (`TransferHook.*`), route helper (`createSettlementRouteConfig`), schemes (`ExactEvmSchemeWithRouterSettlement`), registration (`registerRouterSettlement`), network helpers.
- `@x402x/client`: serverless facilitator client; `execute`, low-level primitives.
- Official x402: `@x402/hono` server middleware; `@x402/client` usable with x402x scheme; `@x402/core`, `@x402/evm`.
- Deprecated: `@x402x/core`, `@x402x/fetch`, `@x402x/hono`, `@x402x/express`; use official SDK + extensions instead.

## Migration v1 → v2 Highlights
- Architecture: modular packages; extensions inject x402x logic into official SDK.
- Dependencies: replace `@x402x/core` and patched `x402` with `@x402x/extensions`; update `@x402x/client` to ^2.3.0.
- Imports: most v1 `@x402x/core` exports now from `@x402x/extensions`; `@x402x/client` re-exports common utilities.
- Client init: `x402xClient` is synchronous (no dynamic import).
- Networks: prefer CAIP-2 IDs (e.g., `eip155:84532`); aliases still accepted.
- Types: stricter `viem` `Address`/`Hex`; cast/validate hex strings as needed.
- Server (Hono): remove `@x402x/hono`; use `@x402/hono @x402/core @x402/evm` + `@x402x/extensions`; compose `x402ResourceServer`, register router settlement extension, use `createSettlementRouteConfig`.
