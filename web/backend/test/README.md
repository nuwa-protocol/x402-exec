# x402 Scanner Backend Tests

测试分为两类：**单元测试**和**集成测试**。

## 🧪 测试结构

```
test/
├── unit/                           # 单元测试（不需要外部依赖）
│   ├── basescan-api.test.ts       # BaseScan API 客户端测试
│   ├── oklink-api.test.ts         # OKLink API 客户端测试
│   ├── parser.test.ts             # 事件解析器测试
│   └── indexer.test.ts            # 索引器逻辑测试
│
└── integration/                    # 集成测试（需要 API Key 和数据库）
    ├── indexer.integration.test.ts # 索引器集成测试
    └── api.integration.test.ts     # API 端点集成测试
```

## 🚀 运行测试

### 运行所有测试
```bash
pnpm test
```

### 只运行单元测试
```bash
pnpm test:unit
```

### 只运行集成测试
```bash
pnpm test:integration
```

### 监视模式（开发时）
```bash
pnpm test:watch
```

### 生成测试覆盖率报告
```bash
pnpm test:coverage
```

## 📋 测试说明

### 单元测试 (test/unit/)

**不需要外部依赖**，可以直接运行：

#### 1. `basescan-api.test.ts`
测试 BaseScan API 客户端功能：
- 客户端创建
- 获取最新区块号
- 获取事件日志
- 获取交易详情
- 速率限制
- 错误处理

**注意**: 需要 `BASESCAN_API_KEY` 环境变量才能运行完整测试。

#### 2. `oklink-api.test.ts`
测试 OKX Web3 API 客户端功能：
- 客户端创建
- 获取区块高度
- 获取地址交易
- 获取交易详情
- 时间戳范围查询
- HMAC SHA256 签名认证
- 速率限制

**注意**: 需要 `OKLINK_API_KEY`、`OKLINK_API_SECRET`、`OKLINK_API_PASSPHRASE` 环境变量才能运行完整测试。

#### 3. `parser.test.ts`
测试事件解析器功能：
- Settled 事件解析
- 交易解析
- BaseScan 日志批量解析
- 数据验证
- 错误处理

**可以离线运行** - 使用模拟数据。

#### 4. `indexer.test.ts`
测试索引器核心逻辑：
- 索引器创建
- 状态管理
- 网络配置

**可以离线运行** - 不需要外部依赖。

### 集成测试 (test/integration/)

**需要外部依赖**：API Keys 和数据库连接。

#### 1. `indexer.integration.test.ts`
测试完整的索引流程：
- Etherscan V2 API 集成（Base 链）
- OKX Web3 API 集成（X-Layer 链）
- 数据库操作
- 端到端索引流程

**前置要求**:
- `ETHERSCAN_API_KEY`（Base 链）
- `OKLINK_API_KEY`、`OKLINK_API_SECRET`、`OKLINK_API_PASSPHRASE`（X-Layer 链）
- `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`
- 已执行 `pnpm run db:init` 和 `pnpm run db:seed`

#### 2. `api.integration.test.ts`
测试所有 REST API 端点：
- 健康检查 (`/api/health`)
- 网络列表 (`/api/networks`)
- 交易查询 (`/api/transactions`)
- 单个交易 (`/api/transaction/:hash`)
- 统计数据 (`/api/stats`)
- Hook 管理 (`/api/hooks`, `/api/hook`)
- 错误处理

**前置要求**:
- 数据库连接
- 已有测试数据（可通过索引器获取或手动插入）

## ⚙️ 配置测试环境

### 1. 创建测试环境变量文件

```bash
cp .env.example .env.test
```

### 2. 填写必要的配置

```bash
# 数据库（必需）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Keys（集成测试需要）
# Etherscan V2 (for Base chains)
ETHERSCAN_API_KEY=your-etherscan-key

# OKX Web3 API (for X-Layer chains)
OKLINK_API_KEY=your-oklink-key
OKLINK_API_SECRET=your-oklink-secret
OKLINK_API_PASSPHRASE=your-passphrase
```

### 3. 初始化数据库

```bash
pnpm run db:init
pnpm run db:seed
```

## 🎯 测试策略

### 开发时
```bash
# 使用监视模式，只运行单元测试（快速反馈）
pnpm test:watch
```

### 提交前
```bash
# 运行所有测试，确保没有破坏现有功能
pnpm test:all
```

### CI/CD
```bash
# 生成覆盖率报告
pnpm test:coverage
```

## 📊 测试覆盖率目标

| 模块 | 目标覆盖率 |
|------|-----------|
| API 客户端 | 80%+ |
| 解析器 | 90%+ |
| 索引器 | 70%+ |
| API 路由 | 80%+ |
| 工具函数 | 90%+ |

## 🐛 常见问题

### Q: 测试提示 "API Key not set"
A: 在 `.env` 文件中设置对应的 API Key，或跳过需要 API Key 的测试。

### Q: 数据库连接失败
A: 检查 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 是否正确，并确认已执行数据库初始化脚本。

### Q: 集成测试超时
A: 增加超时时间或检查网络连接。某些测试默认超时为 60 秒。

### Q: 如何只运行特定测试文件？
```bash
pnpm vitest test/unit/parser.test.ts
```

### Q: 如何只运行特定测试用例？
```bash
# 使用 .only
it.only('should parse valid Settled event', () => {
  // test code
});
```

## 📚 相关文档

- [Vitest 文档](https://vitest.dev/)
- [Supertest 文档](https://github.com/ladjs/supertest)
- [项目 README](../README.md)

## ✅ 最佳实践

1. **单元测试优先**: 为核心逻辑编写单元测试
2. **使用模拟数据**: 单元测试应该使用模拟数据，不依赖外部服务
3. **清晰的测试名称**: 使用描述性的测试名称，说明测试的内容和预期结果
4. **独立的测试**: 每个测试应该独立运行，不依赖其他测试的结果
5. **适当的超时**: 为可能耗时的测试设置合理的超时时间
6. **清理资源**: 测试后清理创建的数据或状态

Happy Testing! 🎉

