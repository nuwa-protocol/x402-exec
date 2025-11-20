# Base 链迁移到 Etherscan V2 - 变更日志

## 📅 日期
2024-01-16

## 🎯 目标
将 Base 和 Base Sepolia 链从 BaseScan API 迁移到统一的 Etherscan V2 API

## ✅ 已完成的更改

### 1. 核心文件修改

#### `src/config.ts`
```diff
  apiKeys: {
-   basescan: process.env.BASESCAN_API_KEY || '',
+   etherscan: process.env.ETHERSCAN_API_KEY || '', // For Base chains
    oklink: process.env.OKLINK_API_KEY || '',      // For X-Layer chains
  },

  networks: {
    'base-sepolia': {
-     explorerApiUrl: 'https://api-sepolia.basescan.org/api',
-     explorerApiType: 'basescan',
+     explorerApiUrl: 'https://api.etherscan.io/v2/api',
+     explorerApiType: 'etherscan',
    },
    'base': {
-     explorerApiUrl: 'https://api.basescan.org/api',
-     explorerApiType: 'basescan',
+     explorerApiUrl: 'https://api.etherscan.io/v2/api',
+     explorerApiType: 'etherscan',
    },
    // X-Layer 链保持不变，仍使用 oklink
  },
```

#### `src/types.ts`
```diff
- export type ExplorerApiType = 'basescan' | 'oklink';
+ export type ExplorerApiType = 'etherscan' | 'oklink';
```

#### `src/indexer/index.ts`
```diff
- import { createBaseScanClient } from './basescan-api.js';
+ import { createEtherscanClient } from './etherscan-api.js';

  constructor(networkName: NetworkName) {
-   if (networkConfig.explorerApiType === 'basescan') {
-     this.apiClient = createBaseScanClient(
-       networkConfig.explorerApiUrl,
-       config.apiKeys.basescan
-     );
+   if (networkConfig.explorerApiType === 'etherscan') {
+     this.apiClient = createEtherscanClient(
+       config.apiKeys.etherscan,
+       networkConfig.chainId,
+       networkConfig.explorerApiUrl
+     );
    } else {
      // OKLink for X-Layer
    }
  }

- private async indexWithBaseScan() { ... }
+ private async indexWithEtherscan() { ... }
```

### 2. 新增文件

#### `src/indexer/etherscan-api.ts`
新的 Etherscan V2 API 客户端，特性：
- ✅ 支持 60+ EVM 链（通过 chainId 参数）
- ✅ 统一的 API 接口
- ✅ 自动速率限制（5 req/sec）
- ✅ 完整的错误处理
- ✅ TypeScript 类型支持

主要方法：
```typescript
class EtherscanApiClient {
  async getLogs(address, fromBlock, toBlock, topic0)
  async getTransaction(txHash)
  async getTransactions(address, startTime, endTime)
  async getLatestBlockNumber()
  async testConnection()
}
```

#### `scripts/test-etherscan.ts`
Etherscan V2 集成测试脚本：
- ✅ 连接测试
- ✅ 最新区块号测试
- ✅ 事件日志获取测试
- ✅ 交易详情测试
- ✅ 速率限制测试

#### 文档文件
- ✅ `API_STATUS.md`: API 使用状态和对比
- ✅ `TESTING_BASE.md`: 详细测试指南
- ✅ `CHANGELOG_ETHERSCAN.md`: 本文件

### 3. 配置文件更新

#### `.env.example`
```diff
  # Block Explorer API Keys
- BASESCAN_API_KEY=your-basescan-api-key
+ # Etherscan V2 API (for Base chains)
+ # Get from: https://etherscan.io/myapikey
+ ETHERSCAN_API_KEY=your-etherscan-api-key
+
+ # OKLink API (for X-Layer chains - temporary)
  OKLINK_API_KEY=your-oklink-api-key
```

#### `package.json`
```diff
  "scripts": {
    "test:explorer": "tsx scripts/test-explorer-api.ts",
+   "test:etherscan": "tsx scripts/test-etherscan.ts",
  }
```

#### `README.md`
- ✅ 更新前置要求
- ✅ 更新功能特性说明
- ✅ 更新配置示例
- ✅ 添加新的测试命令

## 🔄 保持不变的部分

### X-Layer 链配置
```typescript
'x-layer-testnet': {
  explorerApiType: 'oklink',  // 保持不变
  explorerApiUrl: 'https://www.oklink.com/api/v5/explorer',
},
'x-layer': {
  explorerApiType: 'oklink',  // 保持不变
  explorerApiUrl: 'https://www.oklink.com/api/v5/explorer',
},
```

### 现有文件
- ✅ `src/indexer/basescan-api.ts`: 保留（可能被其他代码引用）
- ✅ `src/indexer/oklink-api.ts`: 保留（X-Layer 仍在使用）
- ✅ `src/indexer/parser.ts`: 无需修改
- ✅ 所有其他业务逻辑文件

## 📊 API 对比

| 特性 | BaseScan (旧) | Etherscan V2 (新) |
|------|---------------|-------------------|
| Base 支持 | ✅ | ✅ |
| Base Sepolia 支持 | ✅ | ✅ |
| 多链支持 | ❌ 仅 Base | ✅ 60+ 链 |
| API URL | 每条链单独 | 统一 endpoint |
| Chain ID | 不需要 | 通过参数传递 |
| 文档 | 分散 | 统一文档 |
| 速率限制 | 5 req/sec | 5 req/sec |

## 🧪 测试计划

### 必须测试的功能

1. **连接测试**
   ```bash
   pnpm run test:etherscan
   ```
   - [ ] Base Sepolia 连接成功
   - [ ] Base Mainnet 连接成功

2. **数据获取测试**
   - [ ] 获取最新区块号
   - [ ] 获取事件日志（Settled events）
   - [ ] 获取交易详情
   - [ ] 解析交易数据

3. **索引器测试**
   ```bash
   pnpm run dev
   ```
   - [ ] Base Sepolia 索引正常运行
   - [ ] Base Mainnet 索引正常运行
   - [ ] 交易数据正确存储到数据库

4. **API 端点测试**
   ```bash
   curl http://localhost:3001/api/transactions?network=base
   curl http://localhost:3001/api/stats
   ```
   - [ ] 交易列表正确返回
   - [ ] 统计数据正确聚合

### 性能测试
- [ ] 速率限制正常工作（~5 req/sec）
- [ ] 响应时间合理（< 1 秒）
- [ ] 无内存泄漏

## 🚨 注意事项

### 环境变量
⚠️ **必须更新 `.env` 文件**:
```bash
# 添加新的 key
ETHERSCAN_API_KEY=your-key-here

# 可选：如果不再使用 BaseScan
# BASESCAN_API_KEY=...  # 可以删除或注释
```

### API Key 获取
1. 访问: https://etherscan.io/myapikey
2. 注册/登录账号
3. 创建新的 API key
4. 免费版限制: 5 requests/second

### 向后兼容
- `basescan-api.ts` 文件保留，避免破坏性变更
- X-Layer 链配置不受影响
- 现有数据库数据不需要迁移

## 📋 迁移检查清单

### 开发环境
- [ ] 从 Etherscan 获取 API key
- [ ] 更新 `.env` 文件添加 `ETHERSCAN_API_KEY`
- [ ] 运行 `pnpm install`（如果需要）
- [ ] 运行 `pnpm run test:etherscan` 验证配置
- [ ] 运行 `pnpm run dev` 测试索引器
- [ ] 测试 API 端点

### 生产环境
- [ ] 在生产环境设置 `ETHERSCAN_API_KEY`
- [ ] 更新环境变量配置
- [ ] 运行集成测试
- [ ] 监控日志确认无错误
- [ ] 验证数据正确索引

### 文档
- [ ] 更新团队文档
- [ ] 通知相关人员
- [ ] 更新部署文档

## 🔮 后续计划

### 短期（等待中）
- ⏳ 获取 X-Layer 新的集成方案文档
- ⏳ 评估 X-Layer 的 API 选项

### 中期
- 📋 实现 X-Layer 的新 API 集成
- 📋 移除对 BaseScan API 的依赖
- 📋 优化索引器性能

### 长期
- 📋 考虑支持更多链（利用 Etherscan V2 的多链支持）
- 📋 实现更高级的缓存策略
- 📋 添加实时推送功能

## 🐛 已知问题

### 解决的问题
- ✅ X-Layer 不在 Etherscan V2 支持列表中
  - 解决方案: X-Layer 暂时保持使用 OKLink

### 待解决的问题
- ⏳ X-Layer 的 OKLink API 文档不完整
  - 状态: 等待新的文档和方案

## 📞 支持

如有问题：
1. 查看 `TESTING_BASE.md` 详细测试指南
2. 查看 `API_STATUS.md` 了解当前状态
3. 检查控制台日志
4. 提交 GitHub Issue

---

**变更作者**: AI Assistant  
**审核状态**: ⏳ 待用户测试  
**最后更新**: 2024-01-16

