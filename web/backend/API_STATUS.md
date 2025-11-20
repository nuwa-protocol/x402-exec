# Scanner Backend API Status

## 当前状态 (Current Status)

### Base 链 (Base Chains) ✅

- **Base Mainnet**
- **Base Sepolia Testnet**

**使用 API**: Etherscan V2 API  
**状态**: ✅ 已实现并可测试  
**获取 API Key**: https://etherscan.io/myapikey

### X-Layer 链 (X-Layer Chains) ⏸️

- **X-Layer Mainnet**
- **X-Layer Testnet**

**当前 API**: OKX Web3 API  
**状态**: ✅ 已更新并可测试  
**获取 API Key**: https://www.oklink.com/account/my-api

## API 对比 (API Comparison)

| 特性 | Etherscan V2 | OKX Web3 API | 备注 |
|------|-------------|--------------|------|
| Base 链支持 | ✅ | ❌ | Etherscan V2 官方支持 |
| X-Layer 支持 | ❌ | ✅ | OKX Web3 API 官方支持 |
| 认证方式 | API Key | HMAC SHA256 签名 | OKX 使用更安全的签名认证 |
| 请求限制 | 5 req/sec | 20 req/sec | 基于免费版限制 |
| 稳定性 | 高 | 高 | 两者都很稳定 |
| 文档质量 | 优秀 | 良好 | Etherscan 文档更完善 |

## 测试命令 (Test Commands)

### 测试 Base 链 (Etherscan V2)

```bash
# 确保设置了 ETHERSCAN_API_KEY
export ETHERSCAN_API_KEY=your-api-key

# 运行 Etherscan V2 测试
pnpm run test:etherscan
```

### 测试所有链

```bash
# 需要设置所有 API Keys
export ETHERSCAN_API_KEY=your-etherscan-key
export OKLINK_API_KEY=your-oklink-key
export OKLINK_API_SECRET=your-oklink-secret
export OKLINK_API_PASSPHRASE=your-passphrase

# 运行所有测试
pnpm run test:explorer
```

## 下一步计划 (Next Steps)

### 短期 (Short-term)

1. ✅ 完成 Base 链的 Etherscan V2 集成
2. ✅ 测试和验证 Base 链功能
3. ✅ 更新 X-Layer 的 OKX Web3 API 集成

### 中期 (Mid-term)

1. ✅ 实现 X-Layer 的 OKX Web3 API 集成
2. ✅ 统一两种 API 的接口
3. 🔄 完善错误处理和重试逻辑

### 长期 (Long-term)

1. 📋 考虑添加更多链的支持
2. 📋 优化索引性能
3. 📋 添加实时 WebSocket 推送

## 已知问题 (Known Issues)

### OKX Web3 API (X-Layer)

- ✅ 已更新到最新的认证机制（HMAC SHA256 签名）
- ✅ API 端点已更新到 https://web3.okx.com/api
- 📝 需要三个凭证：API Key、API Secret、Passphrase

### Etherscan V2

- ✅ 目前无已知问题
- ✅ API 稳定性良好
- ✅ 文档完善

## 配置示例 (Configuration Example)

### `.env` 文件配置

```bash
# Etherscan V2 (for Base chains)
ETHERSCAN_API_KEY=your-etherscan-api-key

# OKX Web3 API (for X-Layer chains)
OKLINK_API_KEY=your-oklink-api-key
OKLINK_API_SECRET=your-oklink-api-secret
OKLINK_API_PASSPHRASE=your-oklink-passphrase

# 启用索引器
INDEXER_ENABLED=true
```

### 网络配置 (config.ts)

```typescript
networks: {
  // Base chains - using Etherscan V2
  'base-sepolia': {
    explorerApiType: 'etherscan',
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
  },
  'base': {
    explorerApiType: 'etherscan',
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
  },
  
  // X-Layer chains - using OKX Web3 API
  'x-layer-testnet': {
    explorerApiType: 'oklink',
    explorerApiUrl: 'https://web3.okx.com',
  },
  'x-layer': {
    explorerApiType: 'oklink',
    explorerApiUrl: 'https://web3.okx.com',
  },
}
```

## 技术架构 (Technical Architecture)

```
┌─────────────────────────────────────────┐
│         Multi-Chain Indexer             │
└─────────────────┬───────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
    ┌────▼────┐      ┌────▼────┐
    │  Base   │      │ X-Layer │
    │ Chains  │      │ Chains  │
    └────┬────┘      └────┬────┘
         │                │
    ┌────▼────┐      ┌────▼────┐
    │Etherscan│      │ OKLink  │
    │  V2 API │      │   API   │
    └─────────┘      └─────────┘
         │                │
         └────────┬───────┘
                  │
         ┌────────▼────────┐
         │   Transaction   │
         │     Parser      │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │    Supabase     │
         │   PostgreSQL    │
         └─────────────────┘
```

## 贡献指南 (Contributing)

如果您想贡献代码或报告问题：

1. 查看现有的 [Issues](../../issues)
2. 提交 Pull Request 前先阅读 [CONTRIBUTING.md](../../CONTRIBUTING.md)
3. 确保通过所有测试：`pnpm test:all`

## 联系方式 (Contact)

如有问题或建议，请：
- 提交 GitHub Issue
- 联系项目维护者

---

最后更新：2024-01

