# x402 SDK getDefaultAsset Override 机制实施说明

## 版本信息

- **版本**: 0.6.6-patch.5
- **实施日期**: 2025-12-16
- **实施方案**: BSC_SOLUTION_4_ANALYSIS.md 方案 4b

## 修改内容

### 1. 文件修改

**`deps/x402/typescript/packages/x402/src/shared/middleware.ts`**

#### 添加的内容：

1. **NETWORK_OVERRIDES 配置映射**（第 124-138 行）
   ```typescript
   const NETWORK_OVERRIDES: Partial<Record<Network, {
     version?: string;
     decimals?: number;
   }>> = {
     // BSC uses Wrapped USDT with EIP-712 version "1" instead of "2"
     "bsc-testnet": { version: "1" },
     "bsc": { version: "1" },
     
     // Add more overrides as needed
     // Example: "some-network": { version: "1", decimals: 18 },
   };
   ```

2. **getDefaultAsset 函数增强**（第 140-166 行）
   ```typescript
   export function getDefaultAsset(network: Network) {
     const chainId = getNetworkId(network);
     const usdc = getUsdcChainConfigForChain(chainId);
     if (!usdc) {
       throw new Error(`Unable to get default asset on ${network}`);
     }
     
     // Apply network-specific overrides if configured
     const override = NETWORK_OVERRIDES[network];
     const decimals = override?.decimals ?? 6;
     const version = override?.version ?? "2";
     
     return {
       address: usdc.usdcAddress,
       decimals,
       eip712: {
         name: usdc.usdcName,
         version,
       },
     };
   }
   ```

### 2. 版本升级

**`deps/x402/typescript/packages/x402/package.json`**

```diff
- "version": "0.6.6-patch.4",
+ "version": "0.6.6-patch.5",
```

## 功能说明

### Override 机制

`NETWORK_OVERRIDES` 允许为特定网络覆盖默认的 `decimals` 和 `version` 配置：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `version` | `string` | `"2"` | EIP-712 domain version |
| `decimals` | `number` | `6` | Token decimals |

### 当前 Overrides

| 网络 | Version Override | Decimals Override | 原因 |
|------|------------------|-------------------|------|
| `bsc-testnet` | `"1"` | - (使用默认 6) | BSC Wrapped USDT 使用 version "1" |
| `bsc` | `"1"` | - (使用默认 6) | BSC Wrapped USDT 使用 version "1" |

### 工作原理

1. **无 Override 的网络**（如 Base, X Layer）
   ```typescript
   getDefaultAsset("base-sepolia")
   // 返回: { address: "0x...", decimals: 6, eip712: { name: "USDC", version: "2" } }
   ```

2. **有 Override 的网络**（如 BSC）
   ```typescript
   getDefaultAsset("bsc-testnet")
   // 返回: { address: "0x...", decimals: 6, eip712: { name: "x402 Wrapped USDT", version: "1" } }
   ```

3. **完整 Override 示例**（未来可能使用）
   ```typescript
   // 如果添加：
   // "some-network": { version: "1", decimals: 18 }
   
   getDefaultAsset("some-network")
   // 返回: { address: "0x...", decimals: 18, eip712: { name: "...", version: "1" } }
   ```

## 优点

### ✅ 灵活性
- 可以独立覆盖 `version` 或 `decimals`
- 添加新网络只需一行配置
- 不影响现有网络

### ✅ 可维护性
- 配置与逻辑分离
- 清晰的注释说明
- 易于理解和扩展

### ✅ 向后兼容
- 默认值保持不变（`decimals: 6`, `version: "2"`）
- 现有网络行为不变
- 无破坏性更改

### ✅ 性能
- 零运行时开销
- 编译时类型检查
- O(1) 查询复杂度

## 测试验证

### 手动测试

```typescript
import { getDefaultAsset } from 'x402/shared';

// 测试 1: BSC Testnet 应该使用 version "1"
const bscTestnet = getDefaultAsset("bsc-testnet");
console.assert(bscTestnet.eip712.version === "1", "BSC Testnet version should be 1");
console.assert(bscTestnet.decimals === 6, "BSC Testnet decimals should be 6");

// 测试 2: BSC Mainnet 应该使用 version "1"
const bsc = getDefaultAsset("bsc");
console.assert(bsc.eip712.version === "1", "BSC version should be 1");
console.assert(bsc.decimals === 6, "BSC decimals should be 6");

// 测试 3: Base Sepolia 应该使用默认值
const baseSepolia = getDefaultAsset("base-sepolia");
console.assert(baseSepolia.eip712.version === "2", "Base Sepolia version should be 2");
console.assert(baseSepolia.decimals === 6, "Base Sepolia decimals should be 6");

// 测试 4: X Layer 应该使用默认值
const xlayer = getDefaultAsset("x-layer");
console.assert(xlayer.eip712.version === "2", "X Layer version should be 2");
console.assert(xlayer.decimals === 6, "X Layer decimals should be 6");

console.log("✅ All tests passed!");
```

### 集成测试

在 `@x402x/core` 中验证：

```typescript
import { getNetworkConfig } from '@x402x/core';

// BSC Testnet 应该从 x402 SDK 获取正确的 version
const config = getNetworkConfig('bsc-testnet');
console.log('BSC Testnet version:', config.defaultAsset.eip712.version); // 应该是 "1"
console.log('BSC Testnet decimals:', config.defaultAsset.decimals);      // 应该是 6
```

## 发布步骤

### 1. 构建包

```bash
cd deps/x402/typescript/packages/x402
pnpm build
```

### 2. 发布到 npm

```bash
# 确认版本
cat package.json | grep version

# 发布 patch 包
pnpm publish --tag patch
```

### 3. 在主项目中更新依赖

```bash
cd /path/to/x402-exec_worktrees/wrapped-token-erc3009
pnpm update x402@0.6.6-patch.5
```

### 4. 验证更新

```bash
# 检查版本
pnpm list x402

# 运行测试
pnpm test
```

## 影响范围

### 直接影响

1. **x402 SDK**：`getDefaultAsset()` 函数现在支持 overrides
2. **@x402x/core**：通过 `x402` SDK 自动获得 override 支持
3. **@x402x/client**：自动适配新的配置

### 间接影响

所有依赖 `@x402x/core` 的包都会自动获得 BSC 支持：
- `@x402x/fetch`
- `@x402x/hono`
- `@x402x/express`
- `@x402x/react`
- Facilitator
- Showcase

### 无影响

- `@x402x/core_v2` 系列（独立配置，不依赖 x402 SDK）
- 智能合约（与 SDK 无关）

## 回滚计划

如果需要回滚到之前的版本：

```bash
# 在主项目中
cd /path/to/x402-exec_worktrees/wrapped-token-erc3009
pnpm update x402@0.6.6-patch.4
```

或者使用 git 恢复：

```bash
cd deps/x402
git checkout HEAD~1 typescript/packages/x402/src/shared/middleware.ts
git checkout HEAD~1 typescript/packages/x402/package.json
```

## 未来扩展

### 添加新的 Override

当需要为新网络添加 override 时：

```typescript
const NETWORK_OVERRIDES: Partial<Record<Network, {
  version?: string;
  decimals?: number;
}>> = {
  // 现有配置
  "bsc-testnet": { version: "1" },
  "bsc": { version: "1" },
  
  // 新增网络示例
  "polygon-testnet": { version: "1", decimals: 6 },
  "arbitrum": { decimals: 18 }, // 仅覆盖 decimals
  "optimism": { version: "3" },  // 仅覆盖 version
};
```

### 支持更多参数

如果未来需要覆盖更多参数（如 `address`），可以扩展类型：

```typescript
const NETWORK_OVERRIDES: Partial<Record<Network, {
  version?: string;
  decimals?: number;
  address?: string;      // ✅ 新增
  name?: string;         // ✅ 新增
}>> = {
  // ...
};
```

## 相关文档

- **问题分析**: `BSC_WRAPPED_USDT_ANALYSIS.md`
- **方案对比**: `BSC_SOLUTION_4_ANALYSIS.md`
- **Facilitator 影响**: `FACILITATOR_DECIMALS_IMPACT.md`
- **SDK 分析**: `X402X_SDK_DECIMALS_ANALYSIS.md`
- **Showcase 分析**: `SHOWCASE_DECIMALS_ANALYSIS.md`

## 总结

### ✅ 完成的工作

1. ✅ 添加 `NETWORK_OVERRIDES` 配置映射
2. ✅ 增强 `getDefaultAsset` 函数支持 overrides
3. ✅ 为 BSC 网络配置 version override
4. ✅ 升级版本到 0.6.6-patch.5
5. ✅ 保持向后兼容
6. ✅ 添加详细注释和文档

### 🎯 关键优势

- **最小改动**：仅修改 1 个函数，添加 1 个配置对象
- **零风险**：不影响现有网络的行为
- **易扩展**：添加新网络仅需 1 行配置
- **类型安全**：TypeScript 类型保护
- **高性能**：无额外运行时开销

### 📦 发布清单

- [x] 修改 middleware.ts 添加 override 机制
- [x] 更新 package.json 版本到 0.6.6-patch.5
- [x] 创建实施文档
- [ ] 构建 x402 包（`pnpm build`）
- [ ] 发布到 npm（`pnpm publish --tag patch`）
- [ ] 更新主项目依赖
- [ ] 运行测试验证

**准备就绪，可以发布！** 🚀
