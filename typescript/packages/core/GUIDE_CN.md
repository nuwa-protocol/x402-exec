# @x402x/core 使用指南

## 概述

`@x402x/core` 是一个轻量级的 TypeScript SDK，为 x402 协议提供可编程的 settlement 扩展。它通过插件式的方式增强现有的 x402 工具，最小化开发者的代码改动。

## 安装

```bash
npm install @x402x/core
# 或
pnpm add @x402x/core
# 或
yarn add @x402x/core
```

## 核心概念

### 1. Settlement 模式 vs 标准模式

- **标准模式**：直接使用 EIP-3009 转账（原生 x402）
- **Settlement 模式**：通过 SettlementRouter 执行，支持 Hook 业务逻辑

### 2. Commitment Hash

Commitment hash 是 x402x 的核心安全机制，它将所有 settlement 参数加密绑定到用户的签名，防止参数篡改。

### 3. Builtin Hooks

- **TransferHook**：最简单的 Hook，执行直接转账 + facilitator fee 支持

## 使用场景

### 场景 1：Resource Server 生成 PaymentRequirements

```typescript
import express from 'express';
import { addSettlementExtra, TransferHook, getNetworkConfig } from '@x402x/core';

const app = express();

app.post('/api/purchase', (req, res) => {
  // 基础 PaymentRequirements
  const baseRequirements = {
    scheme: 'exact',
    network: 'base-sepolia',
    maxAmountRequired: '100000', // 0.1 USDC
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
    payTo: merchantAddress,
    resource: '/api/purchase',
    description: 'Purchase premium features',
    mimeType: 'application/json',
    maxTimeoutSeconds: 3600,
  };

  // 添加 settlement 扩展
  const requirements = addSettlementExtra(baseRequirements, {
    hook: TransferHook.getAddress('base-sepolia'),
    hookData: TransferHook.encode(),
    facilitatorFee: '10000', // 0.01 USDC facilitator fee
    payTo: merchantAddress,
  });

  // 返回 402 响应
  res.status(402).json({
    accepts: [requirements],
    x402Version: 1,
  });
});
```

### 场景 2：使用 Express 中间件（更简单）

```typescript
import express from 'express';
import { x402Middleware } from '@x402x/core/middleware/express';

const app = express();

// 使用中间件自动处理 402 响应
app.post('/api/purchase',
  x402Middleware({
    network: 'base-sepolia',
    amount: '100000', // 0.1 USDC
    resource: '/api/purchase',
    description: 'Purchase premium features',
    facilitatorFee: '10000', // 0.01 USDC
  }),
  (req, res) => {
    // 这个 handler 只在支付成功后执行
    res.json({
      success: true,
      message: 'Payment received, features unlocked!',
    });
  }
);
```

### 场景 3：Facilitator 集成

```typescript
import express from 'express';
import { settle } from 'x402/facilitator';
import { createSigner } from 'x402/types';
import {
  isSettlementMode,
  settleWithRouter,
  getNetworkConfig
} from '@x402x/core/facilitator';

const app = express();

app.post('/settle', async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body;
  
  // 创建 signer
  const signer = await createSigner(
    paymentRequirements.network,
    process.env.PRIVATE_KEY
  );

  // 检测 settlement 模式
  if (isSettlementMode(paymentRequirements)) {
    console.log('使用 SettlementRouter 模式');
    
    // 使用 settleWithRouter
    const config = getNetworkConfig(paymentRequirements.network);
    const result = await settleWithRouter(
      signer,
      paymentPayload,
      paymentRequirements,
      {
        allowedRouters: {
          [paymentRequirements.network]: [config.settlementRouter],
        },
      }
    );
    
    res.json(result);
  } else {
    console.log('使用标准 x402 模式');
    
    // 使用标准 settle
    const result = await settle(signer, paymentPayload, paymentRequirements);
    res.json(result);
  }
});
```

### 场景 4：客户端支付（手动实现）

```typescript
import { createWalletClient, custom } from 'viem';
import { calculateCommitment, getNetworkConfig } from '@x402x/core';

async function makePayment(endpoint: string, wallet: any) {
  // 1. 发起请求，获取 402 响应
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status !== 402) {
    throw new Error('Expected 402 response');
  }

  const { accepts } = await response.json();
  const requirements = accepts[0];

  // 2. 检查是否是 settlement 模式
  if (requirements.extra?.settlementRouter) {
    console.log('Settlement 模式，使用 commitment');
    
    // 3. 计算 commitment 作为 nonce
    const config = getNetworkConfig(requirements.network);
    const nonce = calculateCommitment({
      chainId: config.chainId,
      hub: requirements.extra.settlementRouter,
      token: requirements.asset,
      from: wallet.address,
      value: requirements.maxAmountRequired,
      validAfter: '0',
      validBefore: Math.floor(Date.now() / 1000 + 3600).toString(),
      salt: requirements.extra.salt,
      payTo: requirements.extra.payTo,
      facilitatorFee: requirements.extra.facilitatorFee,
      hook: requirements.extra.hook,
      hookData: requirements.extra.hookData,
    });

    // 4. 签署 EIP-712 授权（使用 commitment 作为 nonce）
    // ... 签名逻辑
  } else {
    console.log('标准模式，使用随机 nonce');
    // ... 标准 x402 流程
  }
}
```

## API 快速参考

### 核心函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `calculateCommitment(params)` | 计算 commitment hash | `calculateCommitment({...})` |
| `generateSalt()` | 生成随机 salt | `const salt = generateSalt()` |
| `addSettlementExtra(req, params)` | 添加 settlement 扩展 | `addSettlementExtra(baseReq, {...})` |

### 网络函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `getNetworkConfig(network)` | 获取网络配置 | `getNetworkConfig('base-sepolia')` |
| `getSupportedNetworks()` | 获取支持的网络列表 | `getSupportedNetworks()` |
| `isNetworkSupported(network)` | 检查是否支持网络 | `isNetworkSupported('base')` |

### Builtin Hooks

| Hook | 函数 | 说明 |
|------|------|------|
| TransferHook | `encode()` | 编码 hookData（返回 '0x'） |
| TransferHook | `getAddress(network)` | 获取 Hook 地址 |

### Facilitator 函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `isSettlementMode(requirements)` | 检测是否为 settlement 模式 | `if (isSettlementMode(req))` |
| `settleWithRouter(...)` | 使用 SettlementRouter 执行 | `await settleWithRouter(...)` |
| `validateSettlementRouter(...)` | 验证 router 地址白名单 | `validateSettlementRouter(...)` |

### 中间件

**Express**:
```typescript
import { x402Middleware } from '@x402x/core/middleware/express';
```

**Hono**:
```typescript
import { x402Middleware } from '@x402x/core/middleware/hono';
```

## 支持的网络

| 网络 | Chain ID | SettlementRouter | 状态 |
|------|----------|------------------|------|
| base-sepolia | 84532 | `0x32431D...` | ✅ 可用 |
| x-layer-testnet | 195 | `0x1ae0e1...` | ✅ 可用 |
| base | 8453 | - | 🚧 待审计 |

## 最佳实践

### 1. 始终验证 SettlementRouter 地址

Facilitator 应该维护一个 SettlementRouter 白名单：

```typescript
const ALLOWED_ROUTERS = {
  'base-sepolia': ['0x32431D4511e061F1133520461B07eC42afF157D6'],
  'x-layer-testnet': ['0x1ae0e196dc18355af3a19985faf67354213f833d'],
};
```

### 2. 使用配置而非硬编码

```typescript
// ✅ 好
const config = getNetworkConfig(network);
const hook = TransferHook.getAddress(network);

// ❌ 不好
const hook = '0x6b486aF5A08D27153d0374BE56A1cB1676c460a8';
```

### 3. 错误处理

```typescript
try {
  const config = getNetworkConfig(network);
  // ...
} catch (error) {
  if (error.message.includes('Unsupported network')) {
    res.status(400).json({ error: 'Network not supported' });
  }
}
```

## 常见问题

### Q: 为什么需要 commitment？

A: Commitment 将所有 settlement 参数（hook、hookData、facilitatorFee 等）加密绑定到用户的签名。这防止了 facilitator 或中间人篡改参数。

### Q: TransferHook 和标准 x402 有什么区别？

A: TransferHook 支持 facilitator fee 并通过 SettlementRouter 执行，提供更好的可组合性。标准 x402 直接转账，不支持 facilitator fee。

### Q: 如何添加自定义 Hook？

A: 自定义 Hook 需要部署智能合约。参考 `contracts/examples/` 目录中的示例。在使用 `addSettlementExtra` 时传入自定义 Hook 地址和 hookData。

### Q: 是否向后兼容标准 x402？

A: 完全兼容！Facilitator 可以同时支持两种模式，通过 `isSettlementMode()` 检测并路由到相应的处理逻辑。

## 完整示例

查看项目中的完整示例：

- **Facilitator**: `examples/facilitator/`
- **Showcase**: `examples/showcase/`
- **Smart Contracts**: `contracts/examples/`

## 相关链接

- [GitHub 仓库](https://github.com/nuwa-protocol/x402-exec)
- [完整文档](https://github.com/nuwa-protocol/x402-exec/tree/main/docs)
- [x402 协议](https://github.com/coinbase/x402)

## 许可证

Apache-2.0

