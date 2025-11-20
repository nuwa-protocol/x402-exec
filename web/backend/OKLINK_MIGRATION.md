# OKLink API 升级指南

## 概述

此次升级将 X-Layer 链的 API 从旧的 OKLink 端点迁移到新的 OKX Web3 API，采用更安全的 HMAC SHA256 签名认证机制。

## 主要变更

### 1. API 端点更新

**之前:**
```
https://www.oklink.com/api/v5/explorer
```

**现在:**
```
https://web3.okx.com
```

### 2. 认证机制升级

**之前:** 仅需要 API Key
```bash
OKLINK_API_KEY=your-api-key
```

**现在:** 需要三个凭证（HMAC SHA256 签名）
```bash
OKLINK_API_KEY=your-api-key
OKLINK_API_SECRET=your-api-secret
OKLINK_API_PASSPHRASE=your-passphrase
```

### 3. 签名生成

新的 API 使用 HMAC SHA256 签名机制：

```typescript
// 签名生成步骤
const timestamp = new Date().toISOString();
const method = 'GET';
const requestPath = '/api/v5/xlayer/block/transaction-list';
const body = '';

// 拼接待签名字符串
const preHash = timestamp + method + requestPath + body;

// 使用 API Secret 生成签名
const signature = crypto
  .createHmac('sha256', apiSecret)
  .update(preHash)
  .digest('base64');
```

### 4. HTTP 请求头

**之前:**
```
Ok-Access-Key: <api-key>
```

**现在:**
```
OK-ACCESS-KEY: <api-key>
OK-ACCESS-TIMESTAMP: <iso-timestamp>
OK-ACCESS-PASSPHRASE: <passphrase>
OK-ACCESS-SIGN: <signature>
```

## 升级步骤

### 1. 获取新的 API 凭证

1. 访问 https://www.oklink.com/account/my-api
2. 登录你的 OKX Web3 账号
3. 创建新的 API Key，获取：
   - API Key
   - API Secret（只显示一次，请妥善保存）
   - Passphrase（创建时设置）

### 2. 更新环境变量

编辑你的 `.env` 文件：

```bash
# OKX Web3 API (for X-Layer chains)
OKLINK_API_KEY=your-new-api-key
OKLINK_API_SECRET=your-api-secret
OKLINK_API_PASSPHRASE=your-passphrase
```

### 3. 重启服务

```bash
# 开发环境
pnpm run dev

# 生产环境
pnpm run build
pnpm start
```

## 测试验证

### 1. 测试 OKLink API 客户端

```bash
export OKLINK_API_KEY=your-api-key
export OKLINK_API_SECRET=your-api-secret
export OKLINK_API_PASSPHRASE=your-passphrase

pnpm run test test/unit/oklink-api.test.ts
```

### 2. 测试完整索引流程

```bash
pnpm run test test/integration/indexer.integration.test.ts
```

### 3. 手动测试

启动服务后，访问以下端点测试 X-Layer 索引：

```bash
# 查看索引器状态
curl http://localhost:3001/api/health

# 查询 X-Layer 交易
curl "http://localhost:3001/api/transactions?network=x-layer&limit=10"
```

## 兼容性说明

- ✅ **向后兼容**: 代码自动处理新旧配置格式
- ✅ **Base 链不受影响**: 继续使用 Etherscan V2 API
- ⚠️ **旧 API 凭证将失效**: 请务必更新到新的三件套凭证

## 技术细节

### 修改的文件

1. **src/config.ts**
   - 更新 `apiKeys.oklink` 为对象结构
   - 更新 API URL 到 `https://web3.okx.com/api`

2. **src/indexer/oklink-api.ts**
   - 添加 HMAC SHA256 签名生成
   - 更新请求头格式
   - 更新端点路径

3. **src/indexer/index.ts**
   - 更新 `createOKLinkClient` 调用参数

4. **测试文件**
   - 更新所有测试以使用新的 API 凭证

### API 端点映射

| 功能 | 旧端点 | 新端点 |
|------|--------|--------|
| 交易列表 | `/address/transaction-list` | `/api/v5/xlayer/address/transaction-list` |
| 交易详情 | `/transaction/transaction-fills` | `/api/v5/xlayer/transaction/transaction-fills` |
| 区块列表 | `/block/transaction-list` | `/api/v5/xlayer/block/transaction-list` |

## 常见问题

### Q: 我的旧 API Key 还能用吗？

A: 不能。新的 OKX Web3 API 要求使用三件套凭证（Key + Secret + Passphrase）。

### Q: 签名验证失败怎么办？

A: 检查以下几点：
1. 时间戳格式是否为 ISO 8601（`YYYY-MM-DDTHH:mm:ss.sssZ`）
2. HTTP 方法是否全大写（`GET`）
3. requestPath 是否正确（`/api/v5/xlayer/...`）
4. API Secret 是否正确

### Q: 如何调试签名问题？

A: 在 `oklink-api.ts` 中启用调试日志：

```typescript
// 在 generateSignature 方法中添加
console.log('Timestamp:', timestamp);
console.log('Method:', method);
console.log('RequestPath:', requestPath);
console.log('PreHash:', preHash);
console.log('Signature:', signature);
```

### Q: API 限流是多少？

A: 
- 免费版：20 次/秒
- 如需更高限额，请联系 OKX Web3 支持

## 参考文档

- [OKX Web3 API 文档](https://web3.okx.com/api)
- [API 认证说明](https://web3.okx.com/api/docs#authentication)
- [X-Layer 区块链浏览器](https://www.oklink.com/xlayer)

## 技术支持

如遇到问题，请：

1. 检查 [API_STATUS.md](./API_STATUS.md) 查看当前状态
2. 查看服务日志排查错误
3. 在项目仓库提交 Issue

---

**最后更新**: 2024-01-16
**版本**: v2.0.0

