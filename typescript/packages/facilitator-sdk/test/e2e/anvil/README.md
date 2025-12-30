# Local Chain E2E Tests

End-to-end tests for the router settlement flow using Anvil (Foundry) local chain.

## Overview

These tests validate the complete payment flow from client → server → facilitator → on-chain settlement:

1. **Contract Deployment**: Deploy MockUSDC (EIP-3009), SettlementRouter, and TransferHook
2. **Resource Server**: Start test server with `@x402/hono` + `@x402x/extensions`
3. **Client Request**: Make HTTP request via `@x402/fetch` with payment
4. **402 Response**: Verify `PAYMENT-REQUIRED` with router settlement extension
5. **Payment Creation**: Client creates EIP-712/EIP-3009 payment with commitment nonce
6. **Settlement**: Facilitator executes `settleAndExecute` on SettlementRouter
7. **Hook Execution**: TransferHook distributes funds to merchant
8. **Verification**: Assert final balances match expectations

## Prerequisites

### Install Foundry (Anvil)

```bash
# macOS
brew install foundry

# Linux
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Compile Contracts

```bash
cd contracts
forge build
```

This generates contract artifacts in `contracts/out/` directory.

## Running Tests

### Run All E2E Tests

```bash
# From facilitator-sdk directory
pnpm test:e2e
```

### Run Specific Test

```bash
pnpm test test/e2e/anvil/local-chain.test.ts
```

### Run with Verbose Output

```bash
pnpm test:e2e --reporter=verbose
```

## Test Structure

```
test/e2e/anvil/
├── anvil-manager.ts       # Anvil process lifecycle management
├── contracts.ts           # Contract deployment utilities
├── local-chain.test.ts    # Main E2E test suite
└── README.md             # This file
```

## Test Coverage

### Happy Path Tests

- ✅ Complete payment flow: 402 → payment → settlement → hook execution
- ✅ Multiple sequential payments
- ✅ Facilitator fee accumulation
- ✅ Extension echo behavior

### Failure Path Tests

- ✅ Invalid signature rejection
- ✅ Wrong settlement parameter rejection
- ⏳ Expired payment authorization (planned)

## Configuration

Tests use default configuration in `local-chain.test.ts`:

```typescript
const TEST_CONFIG = {
  anvilPort: 8545,
  serverPort: 3000,
  chainId: 31337,
  price: "1000000",        // 1 USDC (6 decimals)
  facilitatorFee: "10000", // 0.01 USDC
  maxTimeoutSeconds: 3600,
};
```

## Test Accounts

Tests use Anvil's default accounts:

| Account      | Address                                | Private Key (first 32 chars)     | Role         |
|--------------|----------------------------------------|-----------------------------------|--------------|
| Deployer     | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 | 0xac0974bec39a17e36ba4a6b4d238ff... | Deploy contracts |
| Facilitator  | 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 | 0x59c6995e998f97a5a0044966f0945389... | Settlement    |
| Payer        | 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC | 0x5de4111afa1a4b94908f83103eb1f17... | Pays for resource |
| Merchant     | 0x90F79bf6EB2c4f870365E785982E1f101E93b906 | 0x...                             | Recipient    |

## Troubleshooting

### Anvil Not Found

```
Error: spawn anvil ENOENT
```

**Solution**: Install Foundry:
```bash
brew install foundry  # macOS
# or
curl -L https://foundry.paradigm.xyz | bash  # Linux
```

### Contract Artifacts Not Found

```
Error: ENOENT: no such file or directory, open '.../contracts/out/...'
```

**Solution**: Compile contracts:
```bash
cd contracts
forge build
```

### Port Already in Use

```
Error: Anvil is already running
```

**Solution**: Kill existing Anvil process:
```bash
pkill anvil
```

### Tests Timing Out

**Solution**: Increase timeout in `vitest.config.ts`:
```typescript
testTimeout: 120000, // 2 minutes
```

## Architecture

```
┌─────────────────┐
│   Test Client   │
│  (@x402/fetch)  │
└────────┬────────┘
         │ HTTP Request
         ▼
┌─────────────────────────┐
│   Resource Server       │
│   (@x402/hono)          │
│   + x402x Extensions    │
└────────┬────────────────┘
         │ 402 + Requirements
         │
         ▼
┌─────────────────────────┐
│   Payment Creation      │
│   (EIP-712 + EIP-3009)  │
└────────┬────────────────┘
         │ Payment with Signature
         ▼
┌─────────────────────────┐
│   Facilitator SDK       │
│   (@x402x/facilitator)  │
└────────┬────────────────┘
         │ settleAndExecute
         ▼
┌─────────────────────────┐
│   SettlementRouter      │
│   (On-chain Contract)   │
└────────┬────────────────┘
         │ Hook Call
         ▼
┌─────────────────────────┐
│   TransferHook          │
│   (Distribute Funds)    │
└─────────────────────────┘
```

## CI/CD Integration

For CI environments without Foundry:

1. Use Dockerized Anvil:
```yaml
- name: Start Anvil
  run: docker run -d -p 8545:8545 ghcr.io/foundry-rs/foundry:latest anvil --host 0.0.0.0
```

2. Or pre-compile contracts and use mock RPC:

```typescript
// Use a Node-based local chain like hardhat or ganache
const anvilManager = getGlobalAnvil({
  forkUrl: "https://eth-mainnet.alchemyapi.io/v2/...",
});
```

## Related Files

- `test/e2e/mock-contract.test.ts.disabled` - Mock-based E2E tests (legacy)
- `contracts/src/SettlementRouter.sol` - SettlementRouter contract
- `contracts/src/hooks/TransferHook.sol` - TransferHook contract
- `typescript/packages/extensions/` - Core x402x utilities

## Contributing

When adding new E2E tests:

1. Follow the pattern in `local-chain.test.ts`
2. Use `describe` blocks for grouping related tests
3. Clean up state in `beforeEach` if needed
4. Add assertions for on-chain state changes
5. Document any new test configuration in this README
