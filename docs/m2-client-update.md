# M2 Client Update: x402 v2 + x402x Extension Support

## 概述

这次更新让 showcase/client 支持 x402 v2 协议和 x402x router settlement 扩展。

## 关键变更

### 1. x402 v2 协议响应结构

x402 v2 的 `PaymentRequired` 响应结构如下：

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "http://localhost:3000/api/purchase-download",
    "description": "Premium Content Download",
    "mimeType": "application/json"
  },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "1000000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    "maxTimeoutSeconds": 300,
    "extra": {
      "name": "USDC",
      "version": "2",
      "settlementRouter": "0xRouterAddress",
      "hook": "0xHookAddress",
      "hookData": "0x...",
      "payTo": "0xMerchantAddress",
      "facilitatorFee": "0"
    }
  }],
  "extensions": {
    "x402x-router-settlement": {
      "info": {
        "schemaVersion": 1,
        "description": "Router settlement for premium download",
        "salt": "0x..." // ← 动态生成的 salt
      }
    }
  }
}
```

### 2. 参数位置变化

| 参数 | v1 位置 | v2 位置 | 说明 |
|------|---------|---------|------|
| `salt` | `accepts[].extra.salt` | `extensions['x402x-router-settlement'].info.salt` | 每次请求动态生成 |
| `settlementRouter` | `accepts[].extra.settlementRouter` | `accepts[].extra.settlementRouter` | 不变 |
| `hook` | `accepts[].extra.hook` | `accepts[].extra.hook` | 不变 |
| `hookData` | `accepts[].extra.hookData` | `accepts[].extra.hookData` | 不变 |
| `payTo` (final) | `accepts[].extra.payTo` | `accepts[].extra.payTo` | 不变 |

### 3. Client 代码修改

#### `src/hooks/usePayment.ts`

**修改点 1: 添加 `extensions` 字段到 `PaymentResponse` 接口**

```typescript
interface PaymentResponse {
  accepts?: PaymentRequirements[];
  error?: string;
  x402Version?: number;
  extensions?: Record<string, any>; // ← 新增
}
```

**修改点 2: 从 extensions 提取 salt**

```typescript
// For v2 with x402x extension: salt comes from extensions, other params from extra
let salt: string | undefined;

// Try to extract salt from x402x-router-settlement extension (v2)
if (x402Version === 2 && paymentResponse.extensions?.["x402x-router-settlement"]?.info?.salt) {
  salt = paymentResponse.extensions["x402x-router-settlement"].info.salt;
  console.log("[Payment] Step 3: Extracted salt from x402x extension:", salt);
}

// Extract other settlement parameters from extra field
const {
  settlementRouter,
  salt: extraSalt, // Fallback salt from extra (v1 compatibility)
  payTo: finalPayTo,
  facilitatorFee,
  hook,
  hookData,
  name,
  version,
} = paymentReq.extra || {};

// Use extension salt if available, otherwise fall back to extra salt
const finalSalt = salt || extraSalt;
```

**修改点 3: 使用 `finalSalt` 计算 commitment**

```typescript
const commitmentParams = {
  chainId,
  hub: settlementRouter!,
  asset: paymentReq.asset,
  from,
  value,
  validAfter,
  validBefore,
  salt: finalSalt!, // ← 使用从 extensions 提取的 salt
  payTo: finalPayTo!,
  facilitatorFee: facilitatorFee || "0",
  hook: hook!,
  hookData: hookData!,
};
```

### 4. 代码示例文档更新

#### `src/code-examples/premium-download-server.ts`

更新为使用官方 x402 v2 SDK + x402x 扩展的示例：

```typescript
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { registerExactEvmScheme } from "@x402/evm/exact/server/register";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { registerRouterSettlement, createSettlementRouteConfig, TransferHook } from "@x402x/core_v2";

// 1. Initialize x402 Resource Server with facilitator
const facilitatorClient = new HTTPFacilitatorClient({ url: "http://localhost:3001" });
const server = new x402ResourceServer(facilitatorClient);

// 2. Register schemes and extensions
registerExactEvmScheme(server, {});
registerRouterSettlement(server); // Register x402x settlement extension

await server.initialize();

// 3. Define protected route with payment requirements
const routes = {
  "POST /api/purchase-download": createSettlementRouteConfig(
    {
      accepts: {
        scheme: "exact",
        network: "eip155:84532",
        payTo: "0xMerchantAddress",
        price: "$1.00",
      },
      description: "Premium Content Download",
    },
    {
      hook: TransferHook.getAddress("eip155:84532"),
      hookData: TransferHook.encode(),
      finalPayTo: "0xMerchantAddress",
    }
  ),
};
```

#### `src/code-examples/premium-download-client.ts`

更新为展示 x402 v2 协议处理流程：

```typescript
// 2. Server returns 402 Payment Required with x402 v2 + x402x extension
if (response.status === 402) {
  const paymentRequired = await response.json();
  // paymentRequired.x402Version === 2
  // paymentRequired.accepts[0] contains payment requirements
  // paymentRequired.extensions["x402x-router-settlement"] contains salt

  // 3. Extract payment parameters
  const paymentReq = paymentRequired.accepts[0];
  const salt = paymentRequired.extensions["x402x-router-settlement"].info.salt;
  const { settlementRouter, hook, hookData, payTo } = paymentReq.extra;

  // 4. Calculate commitment (nonce = hash of all settlement params)
  const nonce = calculateCommitment({
    chainId, hub: settlementRouter, asset, from,
    value, validAfter, validBefore, salt,
    payTo, facilitatorFee, hook, hookData,
  });

  // 5. Sign EIP-3009 authorization with commitment as nonce
  const signature = await walletClient.signTypedData({
    domain: { name: "USDC", version: "2", chainId, verifyingContract: asset },
    types: { TransferWithAuthorization: [/* ... */] },
    message: { from, to: settlementRouter, value, validAfter, validBefore, nonce },
  });

  // 6. Resend request with X-PAYMENT header
  const finalResponse = await fetch("/api/purchase-download", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": base64url({ x402Version: 2, scheme, network, payload: { signature, authorization } }),
    },
    body: JSON.stringify({ contentId, walletAddress }),
  });
}
```

## 向后兼容性

Client 实现保持了向后兼容：

1. **v1 支持**: 如果 `x402Version === 1` 或未设置，从 `extra.salt` 读取 salt
2. **v2 支持**: 如果 `x402Version === 2`，优先从 `extensions['x402x-router-settlement'].info.salt` 读取
3. **Fallback**: 如果 extension 中没有 salt，会回退到 `extra.salt`

## 测试验证

构建成功：
```bash
cd examples/showcase/client && pnpm build
# ✓ built in 15.77s
```

## 相关文件

- `examples/showcase/client/src/hooks/usePayment.ts` - 主要支付处理逻辑
- `examples/showcase/client/src/code-examples/premium-download-server.ts` - Server 示例代码
- `examples/showcase/client/src/code-examples/premium-download-client.ts` - Client 示例代码
- `examples/showcase/client/src/utils/commitment.ts` - Commitment 计算工具（已更新到使用 `@x402x/core_v2`）

## 下一步

M2 的 client 和 server 更新均已完成。后续可以：
1. 进行端到端测试，验证完整的支付流程
2. 开始 M3：迁移 facilitator 使用官方 SDK + x402x 扩展

