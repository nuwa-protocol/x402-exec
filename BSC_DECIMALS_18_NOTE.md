# BSC Wrapped USDT Decimals = 18 重要发现

## 验证结果

经过链上验证，BSC Wrapped USDT 的 **decimals = 18**（而非最初假设的 6）。

### 合约地址

| 网络 | 合约地址 | Decimals |
|------|---------|----------|
| **BSC Testnet** | `0xdac693b5f14e7ee5923a4830cd2f82ff178f5098` | **18** |
| **BSC Mainnet** | `0x2fDb94bAa9D664a1879BEe1f944F5F5d2dad4451` | **18** |

### 验证命令

```bash
# BSC Testnet
cast call 0xdac693b5f14e7ee5923a4830cd2f82ff178f5098 \
  "decimals()(uint8)" \
  --rpc-url https://data-seed-prebsc-1-s1.binance.org:8545
# 结果: 18

# BSC Mainnet
cast call 0x2fDb94bAa9D664a1879BEe1f944F5F5d2dad4451 \
  "decimals()(uint8)" \
  --rpc-url https://bsc-dataseed.binance.org
# 结果: 18
```

## 配置更新

### x402 SDK Override 配置

已在 `deps/x402/typescript/packages/x402/src/shared/middleware.ts` 中更新：

```typescript
const NETWORK_OVERRIDES: Partial<Record<Network, {
  version?: string;
  decimals?: number;
}>> = {
  // BSC uses Wrapped USDT with EIP-712 version "1" instead of "2"
  // and decimals is 18
  "bsc-testnet": { version: "1", decimals: 18 },
  "bsc": { version: "1", decimals: 18 },
};
```

## 影响分析

### ✅ 自动适配的模块

由于使用 Override 机制，以下模块会**自动获得正确的 decimals**：

1. **x402 SDK** - `getDefaultAsset()` 返回 `decimals: 18`
2. **@x402x/core** - 通过 x402 SDK 自动获得
3. **@x402x/client** - 自动适配
4. **Facilitator** - 如果从 `@x402x/core` 获取配置则自动适配
5. **Showcase** - 如果使用 `@x402x/core` 工具函数则自动适配

### ⚠️ 需要验证的模块

以下模块可能需要验证是否正确使用了动态 decimals：

1. **Facilitator** 中的硬编码位置（参考 `FACILITATOR_DECIMALS_IMPACT.md`）
2. **Showcase** 中的硬编码位置（参考 `SHOWCASE_DECIMALS_ANALYSIS.md`）

## 金额示例

### Decimals = 18 的金额表示

```typescript
// 0.1 token
const amount = "100000000000000000"; // 0.1 * 10^18

// 1 token
const amount = "1000000000000000000"; // 1 * 10^18

// 使用 SDK 自动转换（推荐）
import { parseDefaultAssetAmount } from '@x402x/core';
const amount = parseDefaultAssetAmount('0.1', 'bsc-testnet'); // 自动返回正确值
```

### 与 USDC (decimals=6) 对比

| Token | Decimals | 0.1 Token | 1 Token |
|-------|----------|-----------|---------|
| **USDC** | 6 | `100000` | `1000000` |
| **BSC Wrapped USDT** | 18 | `100000000000000000` | `1000000000000000000` |
| **差异** | +12 | **10^12 倍** | **10^12 倍** |

## 测试建议

### 1. 单元测试

```typescript
import { getDefaultAsset } from 'x402/shared';

// 测试 BSC Testnet
const bscTestnet = getDefaultAsset('bsc-testnet');
expect(bscTestnet.decimals).toBe(18); // ✅ 应该是 18
expect(bscTestnet.eip712.version).toBe("1");

// 测试 BSC Mainnet
const bsc = getDefaultAsset('bsc');
expect(bsc.decimals).toBe(18); // ✅ 应该是 18
expect(bsc.eip712.version).toBe("1");
```

### 2. 集成测试

```typescript
import { parseDefaultAssetAmount, formatDefaultAssetAmount } from '@x402x/core';

// 测试金额转换
const atomicAmount = parseDefaultAssetAmount('0.1', 'bsc-testnet');
expect(atomicAmount).toBe('100000000000000000'); // 0.1 * 10^18

// 测试格式化
const displayAmount = formatDefaultAssetAmount('100000000000000000', 'bsc-testnet');
expect(displayAmount).toBe('0.1');
```

### 3. E2E 测试

在 BSC Testnet 上执行完整的支付流程：
- 创建支付请求
- 签名授权
- 提交 Facilitator
- 验证链上结算
- 确认金额正确

## 文档更新状态

- [x] ✅ `deps/x402/.../middleware.ts` - 更新 Override 配置
- [x] ✅ `deps/x402/.../package.json` - 升级到 0.6.6-patch.5
- [x] ✅ `README.md` - 添加 BSC 网络部署信息
- [x] ✅ `README_CN.md` - 添加 BSC 网络部署信息
- [x] ✅ `BSC_DECIMALS_18_NOTE.md` - 创建此说明文档

## 后续步骤

1. **验证 Facilitator**
   - 检查是否所有地方都使用动态 decimals
   - 运行测试确保金额计算正确

2. **验证 Showcase**
   - 检查金额显示是否正确
   - 测试支付流程

3. **更新相关分析文档**
   - `FACILITATOR_DECIMALS_IMPACT.md`
   - `SHOWCASE_DECIMALS_ANALYSIS.md`
   - `X402X_SDK_DECIMALS_ANALYSIS.md`

## 总结

### ✅ 好消息

通过 Override 机制，BSC 的 `decimals: 18` 已经被正确配置到 x402 SDK 中，所有依赖 SDK 的模块会自动获得正确的值。

### 🎯 关键点

- **BSC Wrapped USDT**: `decimals = 18`, `version = "1"`
- **金额差异**: 比 USDC (decimals=6) 大 **10^12 倍**
- **自动适配**: 使用 `@x402x/core` 工具函数的代码无需修改
- **需要验证**: 硬编码的地方需要更新为动态获取

---

*创建日期: 2025-12-16*  
*版本: 0.6.6-patch.5*
