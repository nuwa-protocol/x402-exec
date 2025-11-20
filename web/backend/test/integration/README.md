# 集成测试文档

## 📋 概述

集成测试使用**真实环境**，包括：
- ✅ 真实的 RPC 节点连接
- ✅ 真实的 Supabase 数据库
- ✅ 真实的区块链数据
- ✅ 完整的 API 服务器

## 🚀 准备工作

### 1. 配置环境变量

确保 `.env.test` 文件配置正确：

```bash
# Supabase 配置（使用真实的测试项目）
SUPABASE_URL=https://your-test-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# RPC 节点（使用公共节点或你自己的节点）
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_RPC_URL=https://mainnet.base.org
X_LAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech/terigon
X_LAYER_RPC_URL=https://rpc.xlayer.tech
```

### 2. 初始化数据库

```bash
# 在 Supabase Dashboard 中执行 schema.sql
# 然后运行：
pnpm run db:seed
```

### 3. 安装依赖

```bash
pnpm install
```

## 🧪 运行测试

### 运行所有集成测试

```bash
pnpm run test:integration
```

### 运行单元测试（不包括集成测试）

```bash
pnpm run test:unit
# 或
pnpm test
```

### 运行所有测试（单元 + 集成）

```bash
pnpm run test:all
```

### 监听模式

```bash
pnpm run test:watch
```

## 📊 测试覆盖

### 1. 索引器集成测试 (`indexer.integration.test.ts`)

#### RPC 连接测试
- ✅ 连接 Base Sepolia RPC
- ✅ 获取当前区块号
- ✅ 获取区块时间戳
- ✅ 连接 X-Layer Testnet RPC

#### 事件获取测试
- ✅ 从 Base Sepolia 获取 SettlementRouter 事件
- ✅ 从 X-Layer Testnet 获取事件
- ✅ 解析真实的 Settled 事件

#### 数据库测试
- ✅ 连接 Supabase 数据库
- ✅ 查询网络配置
- ✅ 验证数据完整性

#### 端到端测试
- ✅ 完整的索引周期（获取区块 → 获取事件 → 解析数据）

### 2. API 集成测试 (`api.integration.test.ts`)

#### 健康检查
- ✅ GET `/api/health` - 服务健康状态

#### 状态查询
- ✅ GET `/api/status` - 索引器状态

#### 交易 API
- ✅ GET `/api/transactions` - 查询交易列表
- ✅ GET `/api/transactions?network=base-sepolia` - 按网络过滤
- ✅ 验证查询参数
- ✅ 错误处理

#### 统计 API
- ✅ GET `/api/stats` - 获取统计数据

#### Hook API
- ✅ GET `/api/hooks` - 查询 Hook 列表
- ✅ POST `/api/hook` - 创建新 Hook
- ✅ 验证数据格式
- ✅ 错误处理

## ⚠️ 注意事项

### 1. 测试超时

集成测试需要访问外部服务，因此设置了较长的超时时间：

```typescript
{ timeout: 30000 }  // 30 秒
{ timeout: 60000 }  // 60 秒（用于复杂操作）
```

### 2. RPC 限流

公共 RPC 节点可能有速率限制。如果测试频繁失败，可以：
- 使用自己的 RPC 节点
- 添加重试逻辑
- 增加测试间的延迟

### 3. 数据库状态

集成测试会修改数据库状态（插入测试数据）。建议：
- 使用独立的测试数据库
- 测试后清理数据
- 或使用事务回滚（如果支持）

### 4. 网络依赖

测试依赖网络连接。在 CI/CD 环境中：
- 确保网络可用
- 考虑使用自托管的 RPC 节点
- 或跳过集成测试，只运行单元测试

## 📝 示例输出

成功的集成测试输出：

```bash
✓ test/integration/indexer.integration.test.ts (10)
  ✓ Indexer Integration Tests
    ✓ RPC Client - Real Connections
      ✓ should connect to Base Sepolia RPC (1234ms)
      ✅ Base Sepolia current block: 12345678
      ✓ should get current block number (567ms)
      ✅ Base Sepolia block 12345678 timestamp: 2024-01-01T00:00:00.000Z
      ✓ should get block timestamp (890ms)
      
    ✓ SettlementRouter Event Fetching
      ✓ should fetch logs from Base Sepolia (2345ms)
      ✅ Found 5 logs in recent 1000 blocks
      ✅ Successfully parsed event: { payer: '0x...', amount: '1000000', ... }
      
    ✓ Database Operations
      ✓ should connect to database (123ms)
      ✅ Database connection successful
      ✓ should fetch network configuration (234ms)
      
    ✓ End-to-End Indexing Test
      ✓ should perform complete indexing cycle (3456ms)
      🚀 Starting E2E indexing test...
      1. Current block: 12345678
      2. Found 5 logs in blocks 12345578-12345678
      3. Successfully parsed 5 Settled events
      ✅ E2E indexing cycle completed successfully

Test Files  2 passed (2)
     Tests  15 passed (15)
   Duration  10.5s
```

## 🔧 故障排查

### 问题：RPC 连接超时

```bash
Error: Request timeout
```

**解决方案：**
1. 检查网络连接
2. 尝试其他 RPC 节点
3. 增加超时时间
4. 检查 RPC URL 是否正确

### 问题：数据库连接失败

```bash
Error: Database connection failed
```

**解决方案：**
1. 确认 Supabase 配置正确
2. 检查 Service Role Key 权限
3. 确认数据库表已创建（运行 schema.sql）
4. 检查网络连接

### 问题：找不到网络数据

```bash
⚠️ Network not found in database
```

**解决方案：**
```bash
pnpm run db:seed
```

### 问题：测试一直挂起

**可能原因：**
- RPC 节点响应慢
- 数据库连接问题
- 防火墙阻止连接

**解决方案：**
1. 使用 `--bail` 选项快速失败
2. 减少超时时间找出问题
3. 逐个运行测试定位问题

## 🎯 最佳实践

### 1. 隔离测试环境

```bash
# 使用独立的测试 Supabase 项目
SUPABASE_URL=https://test-project.supabase.co
```

### 2. 清理测试数据

```typescript
afterAll(async () => {
  // 清理测试创建的 Hook
  await supabase
    .from('x402_hooks')
    .delete()
    .eq('name', 'Test Integration Hook');
});
```

### 3. 使用环境变量

```typescript
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';

describe.skipIf(SKIP_INTEGRATION)('Integration Tests', () => {
  // 测试代码
});
```

### 4. 并发控制

```bash
# 串行运行集成测试（避免 RPC 限流）
pnpm run test:integration --no-threads
```

## 📚 相关文档

- [单元测试文档](../README.md)
- [Vitest 文档](https://vitest.dev/)
- [Supertest 文档](https://github.com/visionmedia/supertest)

---

**集成测试 = 真实世界的验证！** 🌍

