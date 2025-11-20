# 🚀 快速开始 - 测试合约交易获取

## 📋 前置准备

### 1. 创建 .env 文件

```bash
cd /Users/sven/Documents/workspace/sven/x402-exec/web/backend
cp env.example .env
```

### 2. 获取 API Keys

#### Etherscan API Key（必需 - 用于 Base Sepolia）

1. 访问: https://etherscan.io/myapikey
2. 注册/登录账号
3. 点击 "Add" 创建新的 API Key
4. 复制 API Key

#### OKLink API 凭证（可选 - 用于 X-Layer）

1. 访问: https://www.oklink.com/account/my-api
2. 连接钱包登录
3. 创建 API Key
4. 保存三个凭证：
   - API Key
   - API Secret（只显示一次，务必保存）
   - Passphrase（自己设置的密码）

### 3. 编辑 .env 文件

```bash
# 打开 .env 文件
nano .env

# 或使用你喜欢的编辑器
code .env
```

填入以下内容：

```bash
# Etherscan V2 API (for Base chains) - 必需
ETHERSCAN_API_KEY=你的etherscan-api-key

# OKX Web3 API (for X-Layer chains) - 可选
OKLINK_API_KEY=你的oklink-key
OKLINK_API_SECRET=你的oklink-secret
OKLINK_API_PASSPHRASE=你的passphrase
```

## 🧪 运行测试

### 测试 1: Base Sepolia 合约交易

获取合约 `0x817E4F0EE2fbDAAC426f1178e149F7DC98873eCb` 的交易：

```bash
cd /Users/sven/Documents/workspace/sven/x402-exec/web/backend

# 运行测试
pnpm tsx scripts/test-base-sepolia.ts
```

**预期输出：**
```
🚀 Testing Base Sepolia Contract Transactions...

Contract: 0x817E4F0EE2fbDAAC426f1178e149F7DC98873eCb
Network: Base Sepolia (Chain ID: 84532)
✅ Etherscan API key loaded

📡 Fetching recent transactions...

✅ Found 10 recent transactions:

1. Transaction Hash: 0x...
   Block: 12345678
   Time: 2024-01-15T10:30:00.000Z
   From: 0x...
   To: 0x...
   Value: 0 ETH
   Gas Used: 150000
   Status: ✅ Success
...
```

### 测试 2: X-Layer 链交易（可选）

测试 OKLink API 的新签名认证：

```bash
pnpm tsx scripts/test-oklink-simple.ts
```

## 🎯 只想快速测试？

如果你只是想测试 Base Sepolia 的合约，只需要：

1. **获取 Etherscan API Key**（免费，30 秒搞定）
2. **创建 .env 文件**并添加：
   ```bash
   ETHERSCAN_API_KEY=你的key
   ```
3. **运行测试**：
   ```bash
   pnpm tsx scripts/test-base-sepolia.ts
   ```

## ❓ 常见问题

### Q: 提示 "Missing ETHERSCAN_API_KEY"

确保：
1. `.env` 文件存在于 `web/backend/` 目录
2. 文件中有 `ETHERSCAN_API_KEY=...` 这一行
3. API Key 是有效的

### Q: 提示 "No transactions found"

可能原因：
1. 合约地址可能没有交易记录
2. API 可能有延迟
3. 网络选择可能不对

### Q: API 请求失败

可能原因：
1. API Key 无效或过期
2. 达到了 API 限流（免费版限制）
3. 网络连接问题

### Q: 我只想测试某个特定的地址

编辑 `scripts/test-base-sepolia.ts`，修改：

```typescript
const contractAddress = '你的合约地址';
```

## 📚 更多文档

- [完整文档](./README.md)
- [OKLink 升级指南](./OKLINK_MIGRATION.md)
- [API 状态](./API_STATUS.md)
- [测试说明](./test/README.md)

