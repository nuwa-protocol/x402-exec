# x402 Settlement Extension

基于 x402 协议的扩展结算框架，通过极简的设计实现统一收款、自动发货和分账能力。

## 核心设计

### 设计理念

1. **协议层极简**：只有 3 个 extra 字段（settlementHub + hook + hookData）
2. **单一调用**：无需 Multicall3，合约内原子完成所有操作
3. **Facilitator 最小改动**：参数几乎不变，只改调用目标
4. **完全扩展**：分账、发货、NFT 等全部通过 Hook 实现
5. **信任清晰**：资源服务器声明 `payTo = Hub`，Hook 由服务器选择

### 架构图

```
Client (x402)
  ↓ 签名 EIP-3009 授权 (to = SettlementHub)
Facilitator
  ↓ settleAndExecute(token, from, value, ..., signature, hook, hookData)
SettlementHub
  ├─→ token.transferWithAuthorization() 【资金进入 Hub】
  ├─→ hook.execute() 【业务逻辑：分账/发货/NFT/...】
  └─→ 验证余额为 0 【不持币】
```

## 合约

### SettlementHub

核心结算中心，负责：
- 消费 EIP-3009 授权
- 调用 Hook 执行业务逻辑
- 保证幂等性
- 确保不持有资金

**关键方法**：

```solidity
function settleAndExecute(
    address token,
    address from,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    bytes calldata signature,
    address hook,
    bytes calldata hookData
) external;
```

### Hook 接口

```solidity
interface ISettlementHook {
    function execute(
        bytes32 contextKey,
        address payer,
        address token,
        uint256 amount,
        bytes calldata data
    ) external returns (bytes memory);
}
```

### 示例 Hook

1. **RevenueSplitHook** - 分账 Hook
   - 按比例分配收入给多个接收方
   - 用于商户/平台分账场景

2. **NFTMintHook** - NFT 铸造 Hook
   - 付款后自动铸造 NFT 给买家
   - 款项转给商户

3. **NFTMintAndSplitHook** - 组合 Hook
   - 同时完成 NFT 铸造和收入分账
   - 典型 NFT 市场场景

## x402 协议扩展

### PaymentRequirements.extra 字段

```json
{
  "settlementHub": "0x...",  // SettlementHub 合约地址
  "hook": "0x...",           // Hook 合约地址
  "hookData": "0x..."        // Hook 参数（hex 编码）
}
```

### 完整示例

```json
{
  "scheme": "exact",
  "network": "base-sepolia",
  "maxAmountRequired": "1000000",
  "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "payTo": "0xsettlementRouterAddress",
  "resource": "https://api.example.com/nft/mint",
  "description": "Mint NFT with revenue split",
  "mimeType": "application/json",
  "maxTimeoutSeconds": 60,
  "extra": {
    "settlementHub": "0xsettlementRouterAddress",
    "hook": "0xNFTMintAndSplitHookAddress",
    "hookData": "0x..."
  }
}
```

## Facilitator 扩展

### 检测结算模式

```rust
fn is_settlement_mode(requirements: &PaymentRequirements) -> bool {
    requirements.extra
        .as_ref()
        .and_then(|extra| extra.get("settlementHub"))
        .is_some()
}
```

### 调用 SettlementHub

```rust
// 标准模式：
token.transferWithAuthorization(from, to, value, ..., signature)

// 结算模式：
settlementHub.settleAndExecute(token, from, value, ..., signature, hook, hookData)
```

参数几乎完全相同，只是调用目标和多了 hook 参数！

## 开发指南

### 创建自定义 Hook

```solidity
contract MyHook is ISettlementHook {
    address public immutable settlementHub;
    
    modifier onlyHub() {
        require(msg.sender == settlementHub, "Only hub");
        _;
    }
    
    constructor(address _settlementHub) {
        settlementHub = _settlementHub;
    }
    
    function execute(
        bytes32 contextKey,
        address payer,
        address token,
        uint256 amount,
        bytes calldata data
    ) external onlyHub returns (bytes memory) {
        // 1. 解码业务数据
        // 2. 执行业务逻辑
        // 3. 从 settlementHub 转账资金
        // 4. 返回结果
    }
}
```

### Hook 安全要求

1. ✅ **onlyHub 修饰符**：只允许 SettlementHub 调用
2. ✅ **消费全部资金**：Hook 必须将全部 amount 转出或退回
3. ✅ **不持有资金**：Hook 不应保留任何余额
4. ✅ **重入保护**：依赖 SettlementHub 的 nonReentrant
5. ✅ **错误处理**：使用 revert 确保失败时整体回滚

### hookData 编码示例

**TypeScript (ethers.js)**:

```typescript
import { ethers } from 'ethers';

// 分账示例
const splits = [
  { recipient: '0xMerchant', bips: 8500 },
  { recipient: '0xPlatform', bips: 1500 }
];

const hookData = ethers.AbiCoder.defaultAbiCoder().encode(
  ['tuple(address recipient, uint16 bips)[]'],
  [splits]
);
```

**Python (web3.py)**:

```python
from eth_abi import encode

# 分账示例
splits = [
    ('0xMerchant', 8500),
    ('0xPlatform', 1500)
]

hook_data = encode(
    ['(address,uint16)[]'],
    [splits]
)
```

## 部署

### 环境变量

```bash
# RPC 端点
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
export BASE_RPC_URL="https://mainnet.base.org"

# 私钥（部署者）
export DEPLOYER_PRIVATE_KEY="0x..."

# Etherscan API Key（验证合约）
export BASESCAN_API_KEY="..."
```

### 部署脚本

```bash
# 部署 SettlementHub
forge script script/DeploySettlementHub.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast

# 部署 Hook 示例
forge script script/DeployHooks.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast

# 验证合约
forge verify-contract <address> SettlementHub --chain-id 84532
```

## 测试

```bash
# 运行所有测试
forge test

# 运行特定测试
forge test --match-test testSettleAndExecute

# 查看 gas 报告
forge test --gas-report

# 查看覆盖率
forge coverage
```

## 安全考虑

### SettlementHub 安全

- ✅ 不持币：每笔交易后余额必须为 0
- ✅ 重入保护：nonReentrant 修饰符
- ✅ CEI 模式：先标记状态，再调用外部
- ✅ 幂等性：contextKey 一次性使用

### Hook 安全

- ✅ 白名单：资源服务器只声明可信 Hook
- ✅ Gas 限制：Facilitator 可设置 gas limit
- ✅ 金额匹配：Hook 必须消费全部授权金额
- ✅ 隔离：Hook 失败不影响其他交易

### 抢跑处理

**场景**：第三方抢先调用 `transferWithAuthorization`

**结果**：
- EIP-3009 nonce 已被使用
- `settleAndExecute` 调用会失败
- 需要重新请求新的授权

**未来优化**：添加 `executeOnly` 补执行入口

## Gas 优化

| 操作 | Gas 估算 | 说明 |
|------|---------|------|
| transferWithAuthorization | ~60k | token 合约操作 |
| Hook 调用 | ~50k-200k | 取决于 Hook 实现 |
| 总计 | ~110k-260k | 合理范围 |

**优化建议**：
- 使用 immutable 变量
- 减少存储写入
- Hook 内批量操作

## 与其他方案对比

| 维度 | Multicall3 方案 | 本方案 |
|------|----------------|--------|
| Facilitator 改动 | 大：需实现 Multicall3 | 小：只改调用目标 |
| 合约复杂度 | 中：两阶段交易 | 低：单一调用 |
| Gas 成本 | 高：两次合约调用 | 中：一次调用 + Hook |
| 协议复杂度 | 中：定义多个字段 | 低：只有 3 个字段 |
| 扩展性 | 中：协议层添加 | 高：Hook 任意扩展 |

## License

MIT

