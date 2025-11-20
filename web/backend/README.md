# x402 Scanner Backend

区块链索引和查询服务，用于追踪和分析 x402 SettlementRouter 合约的交易数据。

## 🎯 功能特性

- **多链支持**: Base、Base Sepolia、X-Layer、X-Layer Testnet
- **实时索引**: 使用区块浏览器 API（Etherscan V2 for Base + OKX Web3 API for X-Layer）追踪交易
- **RESTful API**: 提供交易查询、统计分析、Hook 管理等接口
- **自动聚合**: 统计交易笔数、USD 交易量、唯一地址数等指标

## 📋 前置要求

- Node.js 18+
- Supabase 账号（用于 PostgreSQL 数据库）
- Etherscan API Key（用于 Base 链）
- OKX Web3 API Key, Secret, Passphrase（用于 X-Layer 链）

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写以下关键配置：

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Keys
# Etherscan V2 API (for Base chains)
# Get from: https://etherscan.io/myapikey
ETHERSCAN_API_KEY=your-etherscan-api-key

# OKX Web3 API (for X-Layer chains)
# Get from: https://www.oklink.com/account/my-api
OKLINK_API_KEY=your-oklink-api-key
OKLINK_API_SECRET=your-oklink-api-secret
OKLINK_API_PASSPHRASE=your-oklink-passphrase

# Indexer
INDEXER_ENABLED=true
INDEXER_POLL_INTERVAL=30000
```

### 3. 初始化数据库

```bash
# 测试数据库连接（会提示手动执行 SQL）
pnpm run db:init

# 手动步骤：在 Supabase Dashboard > SQL Editor 中执行 src/database/schema.sql

# 填充网络配置数据
pnpm run db:seed
```

### 4. 测试 API 连接

```bash
# 测试 Etherscan V2 API (Base chains)
pnpm run test:etherscan

# 测试所有 Explorer APIs
pnpm run test:explorer
```

### 5. 启动服务

```bash
# 开发模式
pnpm run dev

# 生产模式
pnpm run build
pnpm start
```

服务将在 http://localhost:3001 启动

## 📡 API 接口

### 健康检查
- `GET /api/health` - 服务健康状态和索引器信息

### 交易查询
- `GET /api/transactions` - 查询交易列表（支持分页、过滤、排序）
- `GET /api/transaction/:txHash` - 查询单个交易详情

**查询参数**:
- `network`: base | base-sepolia | x-layer | x-layer-testnet
- `hook`: Hook 合约地址
- `payer`: 付款人地址
- `facilitator`: Facilitator 地址
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 20，最大 100）
- `startDate` / `endDate`: 时间范围（ISO 8601 格式）

### 统计数据
- `GET /api/stats` - 综合统计数据
- `GET /api/stats/overview` - 概览统计
- `GET /api/stats/networks` - 按网络统计
- `GET /api/stats/hooks` - 按 Hook 统计
- `GET /api/stats/facilitators` - 按 Facilitator 统计
- `GET /api/stats/timeseries` - 时间序列数据

### Hook 管理
- `GET /api/hooks` - 查询 Hook 列表
- `GET /api/hook/:address?network=base` - 查询 Hook 详情
- `POST /api/hook` - 注册新 Hook
- `PUT /api/hook/:address?network=base` - 更新 Hook 信息

### 网络信息
- `GET /api/networks` - 查询所有支持的网络

## 🏗️ 项目结构

```
src/
├── config.ts              # 配置管理
├── types.ts               # TypeScript 类型
├── index.ts               # 入口文件
├── database/
│   ├── db.ts              # Supabase 客户端
│   ├── schema.sql         # 数据库表结构
│   └── models/            # 数据模型
├── indexer/
│   ├── basescan-api.ts    # BaseScan API 客户端
│   ├── oklink-api.ts      # OKX Web3 API 客户端（X-Layer）
│   ├── parser.ts          # 事件解析器
│   ├── index.ts           # 单链索引器
│   └── multi-chain.ts     # 多链协调器
├── routes/
│   ├── transactions.ts    # 交易路由
│   ├── stats.ts           # 统计路由
│   ├── hooks.ts           # Hook 路由
│   └── index.ts           # 路由汇总
└── utils/
    ├── logger.ts          # 日志工具
    ├── formatter.ts       # 数据格式化
    └── errors.ts          # 错误处理
```

## 🔧 开发脚本

```bash
# 开发模式（热重载）
pnpm run dev

# 构建
pnpm run build

# 生产运行
pnpm start

# 数据库初始化
pnpm run db:init

# 数据库填充
pnpm run db:seed

# 测试 API 连接
pnpm run test:explorer

# 代码检查
pnpm run lint

# 运行测试
pnpm run test
```

## 📊 支持的网络

| 网络 | Chain ID | 类型 | Settlement Router |
|------|----------|------|-------------------|
| Base Sepolia | 84532 | Testnet | 0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb |
| Base | 8453 | Mainnet | 0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B |
| X-Layer Testnet | 195 | Testnet | 0xba9980fb08771e2fd10c17450f52d39bcb9ed576 |
| X-Layer | 196 | Mainnet | 0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B |

## 🔍 索引器工作原理

1. **BaseScan** (Base 链): 使用 `getLogs` API 直接查询 Settled 事件
2. **OKX Web3 API** (X-Layer 链): 查询合约交易列表，解析交易中的事件日志
3. **增量索引**: 记录最后索引的时间戳，只获取新交易
4. **并行处理**: 多个网络同时索引
5. **自动重试**: 处理 API 限流和临时错误

## 🐛 故障排查

### 数据库连接失败
- 检查 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 是否正确
- 确认已执行 `schema.sql`

### API Key 错误
- 确认 API Key 有效且未超出限额
- BaseScan: 每秒 5 次请求
- OKX Web3 API: 每秒 20 次请求

### 无法获取交易
- 检查合约地址是否正确
- 确认网络上有交易记录
- 查看日志了解详细错误

## 📚 相关文档

- [设计文档](../../docs/scanner-backend-design.md)
- [x402 协议文档](../../docs/x402-exec.md)
- [Supabase 文档](https://supabase.com/docs)

## 📄 License

Apache-2.0
