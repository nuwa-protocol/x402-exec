# Contract Verification Guide

## Quick Start

```bash
cd contracts

# Verify on X-Layer (no real API key needed!)
./verify-contracts.sh xlayer

# Verify on Base - BaseScan (requires real API key)
./verify-contracts.sh base

# Verify on Base - OKLink (no real API key needed!)
./verify-contracts.sh base-oklink

# Verify on all networks and explorers
./verify-contracts.sh all

# Show API key setup guide
./verify-contracts.sh keys
```

## ✅ OKLink Verification (Easy - No Real API Key Needed!)

**Good news**: OKLink verification **doesn't require a real API key** for both X-Layer and Base networks!

### X-Layer on OKLink
```bash
./verify-contracts.sh xlayer
```

### Base on OKLink
```bash
./verify-contracts.sh base-oklink
```

The script will automatically set a placeholder API key if not configured.

### Why does it work without a real API key?

OKLink's contract verification API doesn't validate API keys. According to [OKLink's documentation](https://www.oklink.com/docs/en/#developer-tools-contract-verification-verify-contract-source-code):
- Contract verification is free (0 points per call)
- No API key validation for contract verification endpoints
- Tested and confirmed: verification succeeds with placeholder API keys
- **Supports both X-Layer and Base networks**

## ⚠️ BaseScan Verification (Requires Real API Key)

BaseScan requires a **real** API key for automated verification (unlike OKLink).

### Get BaseScan API Key (Free)

1. Visit https://basescan.org/
2. Register an account (completely free)
3. Login → Click profile icon → API Keys
4. Click 'Add' to create new API Key
5. Add to `.env`:
   ```bash
   BASESCAN_API_KEY=your_real_api_key_here
   ```

### Verify on BaseScan
```bash
# After setting BASESCAN_API_KEY in .env
./verify-contracts.sh base
```

## 🌐 Manual Browser Verification (No API Key Needed)

If you prefer not to use API keys, you can verify manually via browser:

### For X-Layer (OKLink):
1. Visit: https://www.oklink.com/xlayer/address/0x73fc659cd5494e69852be8d9d23fe05aab14b29b#code
2. Click 'Contract' tab → 'Verify and Publish'
3. Upload source code with these settings:
   - Compiler: v0.8.20+commit.a1b79de6
   - Optimization: Yes, 200 runs
   - Via IR: Yes

### For Base (BaseScan):
1. Visit: https://basescan.org/address/0x73fc659cd5494e69852be8d9d23fe05aab14b29b#code
2. Click 'Contract' tab → 'Verify and Publish'
3. Same compiler settings as above

### For Base (OKLink):
1. Visit: https://www.oklink.com/base/address/0x73fc659cd5494e69852be8d9d23fe05aab14b29b#code
2. Click 'Contract' tab → 'Verify and Publish'
3. Same compiler settings as above

## 📋 Summary Table

| Network | Explorer | API Key Required? | Command | Notes |
|---------|----------|------------------|---------|-------|
| **X-Layer** | OKLink | ❌ No (any value works) | `./verify-contracts.sh xlayer` | Script auto-sets if missing |
| **Base** | BaseScan | ✅ Yes (real key needed) | `./verify-contracts.sh base` | Free but must be valid |
| **Base** | OKLink | ❌ No (any value works) | `./verify-contracts.sh base-oklink` | Alternative to BaseScan |
| **All** | All above | Mixed | `./verify-contracts.sh all` | Verifies on all explorers |
| **Manual** | Any | ❌ Never | Browser upload | Upload source code manually |

## 🔧 Troubleshooting

### Error: "BASESCAN_API_KEY not found"
Even when verifying X-Layer, foundry.toml requires this variable. Set it to any value:
```bash
export BASESCAN_API_KEY=not-required
```

### Error: "Invalid API Key" (Base only)
Your BaseScan API key is invalid. Get a real one from https://basescan.org/

### Verification failed but no error?
Try manual browser verification or check if contract is already verified.

## 📚 References

- [OKLink Contract Verification API](https://www.oklink.com/docs/en/#developer-tools-contract-verification-verify-contract-source-code)
- [Foundry Verification Guide](https://book.getfoundry.sh/reference/forge/forge-verify-contract)
- [BaseScan API Documentation](https://docs.basescan.org/)

## 🎯 Deployed Contracts

- **SettlementRouter**:
  - Base Mainnet: `0x73fc659cd5494e69852be8d9d23fe05aab14b29b`
  - X-Layer Mainnet: `0x73fc659cd5494e69852be8d9d23fe05aab14b29b`

Both contracts use the same address across networks.

