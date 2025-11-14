# Adding New Networks to Verification Script

The verification script (`verify-contracts.sh`) uses a shared configuration file that makes adding new networks easy and ensures consistency with deployment scripts.

## Architecture

```
network-config.sh          # Shared network configurations (single source of truth)
    ↓
├── deploy-network.sh      # Uses configs for deployment
└── verify-contracts.sh    # Uses configs for verification
```

## Quick Guide

### 1. Add Configuration to `network-config.sh`

Edit `network-config.sh` and add a new entry to the `NETWORK_CONFIGS` array:

```bash
declare -a NETWORK_CONFIGS=(
    # ... existing configs ...
    "network-key|Network Display Name|chain_id|rpc_url|explorer_url|verifier|verifier_url|api_key_var|requires_real_key"
)
```

### 2. Configuration Format

Each field is separated by `|` (pipe character):

| Field | Description | Example |
|-------|-------------|---------|
| `network-key` | Unique identifier for CLI | `arbitrum`, `polygon`, `optimism` |
| `Network Display Name` | Human-readable name | `Arbitrum One`, `Polygon Mainnet` |
| `chain_id` | Chain ID or name | `42161`, `137`, `optimism` |
| `rpc_url` | Default RPC endpoint | `https://arb1.arbitrum.io/rpc` |
| `explorer_url` | Block explorer URL | `https://arbiscan.io` |
| `verifier` | Verifier type | `etherscan`, `oklink`, `blockscout` |
| `verifier_url` | Verifier API URL (empty for etherscan) | `https://...` or empty |
| `api_key_var` | Environment variable name | `ARBISCAN_API_KEY` |
| `requires_real_key` | Whether real API key needed | `true` or `false` |

### 3. Examples

#### Example 1: Arbitrum on Arbiscan (Etherscan-compatible)
```bash
"arbitrum|Arbitrum One|42161|https://arb1.arbitrum.io/rpc|https://arbiscan.io|etherscan||ARBISCAN_API_KEY|true"
```

#### Example 2: Arbitrum on OKLink (No Real API Key Required)
```bash
"arbitrum-oklink|Arbitrum One (OKLink)|42161|https://arb1.arbitrum.io/rpc|https://www.oklink.com/arbitrum|oklink|https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/ARBITRUM|OKLINK_API_KEY|false"
```

#### Example 3: Polygon on PolygonScan
```bash
"polygon|Polygon Mainnet|137|https://polygon-rpc.com|https://polygonscan.com|etherscan||POLYGONSCAN_API_KEY|true"
```

## Complete Example

Let's add Arbitrum with both Arbiscan and OKLink support:

```bash
declare -a NETWORK_CONFIGS=(
    # Existing configs...
    "base-sepolia|Base Sepolia Testnet|84532|https://sepolia.base.org|https://sepolia.basescan.org|etherscan||BASESCAN_API_KEY|true"
    "base|Base Mainnet|8453|https://mainnet.base.org|https://basescan.org|etherscan||BASESCAN_API_KEY|true"
    "base-oklink|Base Mainnet (OKLink)|8453|https://mainnet.base.org|https://www.oklink.com/base|oklink|https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/BASE|OKLINK_API_KEY|false"
    "xlayer-testnet|X-Layer Testnet|1952|https://testrpc.xlayer.tech/terigon|https://www.oklink.com/xlayer-test|oklink|https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER_TESTNET|OKLINK_API_KEY|false"
    "xlayer|X-Layer Mainnet|196|https://rpc.xlayer.tech|https://www.oklink.com/xlayer|oklink|https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER|OKLINK_API_KEY|false"
    
    # New Arbitrum entries
    "arbitrum|Arbitrum One|42161|https://arb1.arbitrum.io/rpc|https://arbiscan.io|etherscan||ARBISCAN_API_KEY|true"
    "arbitrum-oklink|Arbitrum One (OKLink)|42161|https://arb1.arbitrum.io/rpc|https://www.oklink.com/arbitrum|oklink|https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/ARBITRUM|OKLINK_API_KEY|false"
)
```

## After Adding

### 1. Test the Configuration

```bash
# List all networks to verify configuration is correct
./verify-contracts.sh list

# Test verification
./verify-contracts.sh arbitrum

# Test deployment (if applicable)
./deploy-network.sh arbitrum --settlement
```

### 2. No Code Changes Needed!

Both scripts automatically:
- ✅ Detect new networks
- ✅ Generate help messages
- ✅ Support new network in `all` command
- ✅ Handle API key requirements

### 3. Usage

Once added, users can immediately use:

```bash
# Verification
./verify-contracts.sh arbitrum           # Verify on Arbiscan
./verify-contracts.sh arbitrum-oklink    # Verify on OKLink
./verify-contracts.sh all                # Includes new networks

# Deployment (if deployment network)
./deploy-network.sh arbitrum --settlement
```

## Supported Verifiers

### OKLink
- **API Key**: Not validated (any value works)
- **Supported Networks**: ETH, XLAYER, BSC, POLYGON, AVAXC, FTM, OP, ARBITRUM, LINEA, MANTA, CANTO, BASE, SCROLL, etc.
- **URL Pattern**: `https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/{CHAIN_SHORT_NAME}`
- **Explorer Pattern**: `https://www.oklink.com/{network}`
- **Chain Short Names**: Check [OKLink Docs](https://www.oklink.com/docs/en/#explorer-api-tools-contract-verification)

### Etherscan (and variants)
- **API Key**: Required and validated
- **Supported**: All Etherscan-compatible explorers
  - Ethereum: Etherscan (`etherscan.io`)
  - Base: BaseScan (`basescan.org`)
  - Arbitrum: Arbiscan (`arbiscan.io`)
  - Polygon: PolygonScan (`polygonscan.com`)
  - Optimism: Optimistic Etherscan (`optimistic.etherscan.io`)
  - And many more...
- **verifier_url**: Leave empty (uses `--etherscan-api-key` parameter)
- **Free API Keys**: Available from respective explorer websites

### Blockscout
- **API Key**: Depends on instance configuration
- **verifier**: `blockscout`
- **verifier_url**: Instance-specific URL
- **Popular Instances**: Gnosis Chain, POA Network, etc.

## Network Naming Conventions

### For Deployment Networks (used in `deploy-network.sh`)
Use simple network names:
```
base-sepolia    # Testnet
base            # Mainnet
xlayer-testnet  # Testnet
xlayer          # Mainnet
```

### For Verification Networks (multiple explorers)
Use `network-explorer` format:
```
base            # Base on BaseScan (primary)
base-oklink     # Base on OKLink (alternative)
arbitrum        # Arbitrum on Arbiscan (primary)
arbitrum-oklink # Arbitrum on OKLink (alternative)
```

## Tips

1. **Use descriptive network keys**: Help users understand which explorer they're using
2. **Test both explorers**: If a network supports multiple explorers, add both
3. **OKLink advantage**: No real API key needed, great for quick verification
4. **Keep it organized**: Group by network, add comments
5. **Consistent naming**: Follow the `network-explorer` pattern for alternative explorers

## Benefits of Shared Configuration

- ✅ **Single source of truth**: All network configs in one place
- ✅ **No code duplication**: Both scripts use same configs
- ✅ **Easy maintenance**: Add/modify network = edit 1 line
- ✅ **Self-documenting**: `list` command shows all networks
- ✅ **Consistent behavior**: Deploy and verify use same settings
- ✅ **Scalable**: Add unlimited networks without touching script logic

## Migration Notes

If you have custom networks in older versions:
1. Extract your network configs
2. Convert to pipe-delimited format
3. Add to `NETWORK_CONFIGS` array in `network-config.sh`
4. Delete old code - it's no longer needed!

