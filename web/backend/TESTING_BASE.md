# Base 链 Etherscan V2 集成测试指南

## ✅ 已完成的更改

### 1. 配置更新

- ✅ `src/config.ts`: Base 链改用 Etherscan V2 API
  - `explorerApiType`: `'basescan'` → `'etherscan'`
  - `explorerApiUrl`: `'https://api.etherscan.io/v2/api'`
  - `apiKeys.etherscan`: 新增 Etherscan V2 API key 配置

- ✅ `src/types.ts`: 更新 API 类型定义
  - `ExplorerApiType`: `'basescan' | 'oklink'` → `'etherscan' | 'oklink'`

### 2. 新增文件

- ✅ `src/indexer/etherscan-api.ts`: Etherscan V2 API 客户端实现
  - 支持 Base 和 Base Sepolia
  - 统一的 API 接口（getLogs, getTransaction, getLatestBlockNumber）
  - 内置速率限制（5 req/sec）
  - 完整的错误处理和重试逻辑

- ✅ `scripts/test-etherscan.ts`: Etherscan V2 集成测试脚本
  - 连接测试
  - 获取最新区块
  - 获取事件日志
  - 获取交易详情
  - 速率限制测试

### 3. 索引器更新

- ✅ `src/indexer/index.ts`: 更新索引器逻辑
  - Base 链使用 `createEtherscanClient()`
  - X-Layer 链继续使用 `createOKLinkClient()`
  - 新增 `indexWithEtherscan()` 方法
  - 保留 `indexWithOKLink()` 方法

### 4. 文档更新

- ✅ `README.md`: 更新 API 要求和配置说明
- ✅ `API_STATUS.md`: 新增 API 状态文档
- ✅ `.env.example`: 更新环境变量示例

## 🧪 测试步骤

### 步骤 1: 准备 API Key

1. 访问 https://etherscan.io/myapikey
2. 登录或注册账号
3. 创建新的 API key
4. 复制 API key

### 步骤 2: 配置环境变量

编辑 `web/backend/.env` 文件：

```bash
# 添加或更新以下配置
ETHERSCAN_API_KEY=你的-etherscan-api-key

# 确保这些配置正确
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# X-Layer 暂时保持 OKLink
OKLINK_API_KEY=your-oklink-key
```

### 步骤 3: 安装依赖（如果还没安装）

```bash
cd web/backend
pnpm install
```

### 步骤 4: 运行 Etherscan V2 测试

```bash
cd web/backend
pnpm run test:etherscan
```

#### 预期输出

```
========================================
Etherscan V2 API Integration Test
========================================

==================================================
Testing Base Sepolia
==================================================

[Base Sepolia] Testing connection...
✅ [Base Sepolia] Connection successful

[Base Sepolia] Testing getLatestBlockNumber...
✅ [Base Sepolia] Latest block: 12345678

[Base Sepolia] Testing getLogs...
  Fetching logs from block 12344678 to 12345678...
✅ [Base Sepolia] Found 10 logs
  Sample log:
    - Transaction: 0x123...
    - Block: 12345000
    - Timestamp: 2024-01-16T12:00:00.000Z
    - Topics: 4

[Base Sepolia] Testing getTransaction...
  Fetching transaction 0x123...
✅ [Base Sepolia] Transaction found:
    - From: 0xabc...
    - To: 0xdef...
    - Status: success
    - Gas Used: 150000
    - Block: 12345000

==================================================
Testing Base
==================================================

... (类似的输出) ...

[Rate Limit] Testing rate limiting (5 req/sec)...
✅ [Rate Limit] Made 10 requests in 2000ms (5.00 req/sec)
✅ [Rate Limit] Rate limiting working correctly

========================================
✅ All tests completed!
========================================
```

### 步骤 5: 测试数据库集成

```bash
# 1. 初始化数据库（如果还没有）
pnpm run db:init
# 然后在 Supabase Dashboard 执行 src/database/schema.sql

# 2. 填充网络配置
pnpm run db:seed

# 3. 启动开发服务器
pnpm run dev
```

#### 预期输出

```
[Indexer:base-sepolia] Starting indexer...
[Indexer:base-sepolia] Resuming from timestamp: 0
[Indexer:base] Starting indexer...
[Indexer:base] Resuming from timestamp: 0
[Indexer:x-layer-testnet] Starting indexer...
[Indexer:x-layer] Starting indexer...
Server is running on http://localhost:3001
```

### 步骤 6: 测试 API 端点

```bash
# 测试统计接口
curl http://localhost:3001/api/stats

# 测试交易列表（Base Sepolia）
curl http://localhost:3001/api/transactions?network=base-sepolia&limit=10

# 测试交易列表（Base）
curl http://localhost:3001/api/transactions?network=base&limit=10
```

## 🔍 验证清单

- [ ] Etherscan V2 API 连接成功
- [ ] 能够获取最新区块号
- [ ] 能够获取事件日志
- [ ] 能够获取交易详情
- [ ] 速率限制正常工作（约 5 req/sec）
- [ ] 数据库能正确存储索引的交易
- [ ] API 端点返回正确的数据
- [ ] Base Sepolia 和 Base 两个网络都能正常工作

## 🐛 常见问题

### 问题 1: API Key 无效

**错误**: `Etherscan API error: Invalid API Key`

**解决**:
1. 检查 `.env` 文件中的 `ETHERSCAN_API_KEY` 是否正确
2. 确保 API key 已经激活（注册后可能需要几分钟）
3. 访问 https://etherscan.io/myapikey 验证 key 状态

### 问题 2: 请求速率限制

**错误**: `Max rate limit reached`

**解决**:
1. 免费版限制为 5 req/sec
2. 代码已实现自动速率限制（200ms/请求）
3. 如需更高限制，考虑升级 Etherscan 账号

### 问题 3: 找不到交易

**错误**: `No records found`

**解决**:
1. 这是正常的，如果最近没有交易发生
2. 可以尝试扩大区块范围：修改测试脚本中的 `latestBlock - 1000` 为更大值
3. 确认 Settlement Router 地址是否正确

### 问题 4: 类型错误

**错误**: TypeScript 编译错误

**解决**:
```bash
# 清理并重新构建
rm -rf dist/
pnpm run build
```

## 📊 性能预期

### Etherscan V2 API

- **请求延迟**: ~200-500ms
- **速率限制**: 5 req/sec (免费版)
- **可靠性**: 99%+
- **数据延迟**: 实时 (< 1 分钟)

### 索引性能

- **轮询间隔**: 30 秒（可配置）
- **批量大小**: 100 笔交易/请求（可配置）
- **区块范围**: 约 1000 区块/请求（Base: ~33 分钟）

## 🎯 下一步

✅ 当前阶段：Base 链使用 Etherscan V2
⏳ 等待文档：X-Layer 链新的集成方案
🔄 未来计划：统一 API 接口，优化性能

## 📝 测试日志

### 测试日期: ______

- [ ] 测试人员: ______
- [ ] 环境: development / production
- [ ] Base Sepolia: 通过 / 失败
- [ ] Base Mainnet: 通过 / 失败
- [ ] 备注:

---

## 技术支持

如遇到问题：
1. 查看控制台日志
2. 检查 `.env` 配置
3. 查看 `API_STATUS.md` 了解当前状态
4. 提交 GitHub Issue

最后更新：2024-01-16

