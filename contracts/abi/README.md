# x402 Settlement Extension ABI

本目录包含 SettlementHub 和 Hook 合约的 ABI 文件。

## 文件

- `SettlementHub.json` - SettlementHub 合约 ABI
- `ISettlementHook.json` - ISettlementHook 接口 ABI
- `IERC3009.json` - IERC3009 接口 ABI

## 生成 ABI

使用 Foundry 编译合约后，可以从以下位置提取 ABI：

```bash
cd contracts
forge build
cat out/SettlementHub.sol/SettlementHub.json | jq '.abi' > abi/SettlementHub.json
cat out/ISettlementHook.sol/ISettlementHook.json | jq '.abi' > abi/ISettlementHook.json
cat out/IERC3009.sol/IERC3009.json | jq '.abi' > abi/IERC3009.json
```

## 使用

### TypeScript/JavaScript

```typescript
import { ethers } from 'ethers';
import SettlementHubABI from './abi/SettlementHub.json';

const settlement Hub = new ethers.Contract(
  settlementRouterAddress,
  SettlementHubABI,
  signer
);
```

### Rust

```rust
use alloy::sol;

sol! {
    #[sol(rpc)]
    #[derive(Debug)]
    SettlementHub,
    "abi/SettlementHub.json"
}

let settlement_hub = SettlementHub::new(address, provider);
```

### Python

```python
from web3 import Web3
import json

with open('abi/SettlementHub.json') as f:
    abi = json.load(f)

settlement_hub = w3.eth.contract(
    address=settlement_hub_address,
    abi=abi
)
```

