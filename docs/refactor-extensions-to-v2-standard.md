# 重构需求：将 x402x 扩展参数移至 v2 标准位置

## 背景

当前实现中，x402x router settlement 的参数分散在两个位置：
1. `accepts[].extra` - 包含 `settlementRouter`, `hook`, `hookData`, `payTo`, `facilitatorFee` 等
2. `extensions['x402x-router-settlement'].info` - 只包含 `salt`

根据 x402 v2 规范（`deps/x402_upstream_main/specs/x402-specification-v2.md`），这种做法不符合标准。

## x402 v2 规范定义

### `extra` 字段
- **位置**: `PaymentRequirements.extra` (`accepts[].extra`)
- **用途**: **Scheme-specific 信息**（与支付方案相关的参数）
- **示例**: EIP-712 domain 参数（name, version）

### `extensions` 字段
- **位置**: 顶层 `PaymentRequired.extensions` 和 `PaymentPayload.extensions`
- **用途**: **协议扩展功能**（核心支付机制之外的模块化可选功能）
- **规范说明**: "Extensions enable modular optional functionality beyond core payment mechanics"
- **结构**:
  ```typescript
  {
    "extensions": {
      "[extension-identifier]": {
        "info": { /* Extension-specific data */ },
        "schema": { /* JSON Schema */ }
      }
    }
  }
  ```

## 问题分析

### 当前 PaymentRequired 响应结构（不符合规范）

```json
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "1000000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0xSettlementRouter",
    "extra": {
      "name": "USDC",                    // ✅ Scheme-specific (EIP-712)
      "version": "2",                    // ✅ Scheme-specific (EIP-712)
      "settlementRouter": "0x...",       // ❌ 应该在 extensions
      "hook": "0x...",                   // ❌ 应该在 extensions
      "hookData": "0x...",               // ❌ 应该在 extensions
      "payTo": "0xMerchantAddress",      // ❌ 应该在 extensions
      "facilitatorFee": "0"              // ❌ 应该在 extensions
    }
  }],
  "extensions": {
    "x402x-router-settlement": {
      "info": {
        "schemaVersion": 1,
        "description": "Router settlement for premium download",
        "salt": "0x..."                  // ✅ Extension-specific
      }
    }
  }
}
```

### 问题
1. Router settlement 参数是**扩展功能**，不是 scheme-specific，应该放在 `extensions`
2. 当前混合放置导致语义不清
3. 不利于未来添加其他 extensions

## 目标架构

### 符合 v2 规范的 PaymentRequired 响应结构

```json
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "1000000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0xSettlementRouter",      // 指向 settlement router
    "extra": {
      "name": "USDC",                   // ✅ 只保留 EIP-712 domain 参数
      "version": "2"                    // ✅ 只保留 EIP-712 domain 参数
    }
  }],
  "extensions": {
    "x402x-router-settlement": {
      "info": {
        "schemaVersion": 1,
        "description": "Router settlement with atomic fee distribution",
        "salt": "0x...",                // ✅ 所有 settlement 参数
        "settlementRouter": "0x...",    // ✅ 移到这里
        "hook": "0x...",                // ✅ 移到这里
        "hookData": "0x...",            // ✅ 移到这里
        "finalPayTo": "0xMerchant",     // ✅ 移到这里（重命名以区分）
        "facilitatorFee": "0"           // ✅ 移到这里
      },
      "schema": {
        "type": "object",
        "properties": {
          "schemaVersion": { "type": "number" },
          "salt": { "type": "string", "pattern": "^0x[a-fA-F0-9]{64}$" },
          "settlementRouter": { "type": "string", "pattern": "^0x[a-fA-F0-9]{40}$" },
          "hook": { "type": "string", "pattern": "^0x[a-fA-F0-9]{40}$" },
          "hookData": { "type": "string", "pattern": "^0x[a-fA-F0-9]*$" },
          "finalPayTo": { "type": "string", "pattern": "^0x[a-fA-F0-9]{40}$" },
          "facilitatorFee": { "type": "string" }
        },
        "required": ["schemaVersion", "salt", "settlementRouter", "hook", "hookData", "finalPayTo"]
      }
    }
  }
}
```

## 需要修改的文件

### 1. Server 端

#### 1.1 `typescript/packages/core_v2/src/settlement-routes.ts`

**修改 `createSettlementRouteConfig` 函数**:

**当前逻辑**:
```typescript
const settlementExtra = {
  settlementRouter: networkConfig.settlementRouter,
  hook,
  hookData,
  payTo: settlementOptions.finalPayTo,
  facilitatorFee: settlementOptions.facilitatorFee || "0",
  name: networkConfig.defaultAsset.eip712.name,
  version: networkConfig.defaultAsset.eip712.version,
};

const enhancedOption: SettlementPaymentOption = {
  ...option,
  payTo: networkConfig.settlementRouter,
  extra: {
    ...(option.extra || {}),
    ...settlementExtra, // ❌ 全部放 extra
  },
};
```

**目标逻辑**:
```typescript
// 只保留 EIP-712 domain 参数在 extra
const enhancedOption: SettlementPaymentOption = {
  ...option,
  payTo: networkConfig.settlementRouter,
  extra: {
    ...(option.extra || {}),
    name: networkConfig.defaultAsset.eip712.name,    // ✅ EIP-712
    version: networkConfig.defaultAsset.eip712.version, // ✅ EIP-712
  },
};

// Settlement 参数放到 extensions.info
const extensions = {
  ...(baseConfig.extensions || {}),
  [ROUTER_SETTLEMENT_KEY]: {
    info: {
      schemaVersion: 1,
      description: settlementOptions.description || "Router settlement with atomic fee distribution",
      settlementRouter: networkConfig.settlementRouter,
      hook,
      hookData,
      finalPayTo: settlementOptions.finalPayTo,
      facilitatorFee: settlementOptions.facilitatorFee || "0",
      // salt will be dynamically injected by enrichDeclaration
    },
    schema: {
      type: "object",
      properties: {
        schemaVersion: { type: "number" },
        salt: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
        settlementRouter: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
        hook: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
        hookData: { type: "string", pattern: "^0x[a-fA-F0-9]*$" },
        finalPayTo: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
        facilitatorFee: { type: "string" },
      },
      required: ["schemaVersion", "salt", "settlementRouter", "hook", "hookData", "finalPayTo"],
    },
  },
};
```

#### 1.2 `typescript/packages/core_v2/src/server-extension.ts`

**修改 `enrichDeclaration` 确保 salt 正确注入**:

当前实现已经在 `enrichDeclaration` 中动态生成 salt，但需要确保所有 settlement 参数都在 `info` 中：

```typescript
enrichDeclaration: (declaration, transportContext) => {
  const extension = declaration as RouterSettlementDeclaration;
  
  // Ensure info exists with all required fields
  const enriched: RouterSettlementDeclaration = {
    ...extension,
    info: {
      ...(extension.info || {}),
      // Dynamically generate salt if not already present
      salt: (extension.info as any)?.salt || generateSalt(),
    },
  };
  
  return enriched;
},
```

这部分应该不需要大改，因为 `createSettlementRouteConfig` 会预填充所有参数，`enrichDeclaration` 只需要注入 salt。

### 2. Client 端

#### 2.1 `examples/showcase/client/src/hooks/usePayment.ts`

**修改参数提取逻辑**:

**当前逻辑**:
```typescript
// Try to extract salt from x402x-router-settlement extension (v2)
if (x402Version === 2 && paymentResponse.extensions?.["x402x-router-settlement"]?.info?.salt) {
  salt = paymentResponse.extensions["x402x-router-settlement"].info.salt;
}

// Extract other settlement parameters from extra field
const {
  settlementRouter,
  salt: extraSalt,
  payTo: finalPayTo,
  facilitatorFee,
  hook,
  hookData,
  name,
  version,
} = paymentReq.extra || {};

const finalSalt = salt || extraSalt;
```

**目标逻辑**:
```typescript
// Extract EIP-712 domain parameters from extra (scheme-specific)
const { name, version } = paymentReq.extra || {};

// Extract ALL settlement parameters from extensions (if v2 with x402x extension)
let settlementParams: {
  salt?: string;
  settlementRouter?: string;
  hook?: string;
  hookData?: string;
  finalPayTo?: string;
  facilitatorFee?: string;
} = {};

if (x402Version === 2 && paymentResponse.extensions?.["x402x-router-settlement"]?.info) {
  const extensionInfo = paymentResponse.extensions["x402x-router-settlement"].info;
  settlementParams = {
    salt: extensionInfo.salt,
    settlementRouter: extensionInfo.settlementRouter,
    hook: extensionInfo.hook,
    hookData: extensionInfo.hookData,
    finalPayTo: extensionInfo.finalPayTo,
    facilitatorFee: extensionInfo.facilitatorFee || "0",
  };
  console.log("[Payment] Step 3: Extracted settlement params from x402x extension:", settlementParams);
} else {
  // Fallback for v1 or old format: read from extra
  const {
    settlementRouter,
    salt,
    payTo: finalPayTo,
    facilitatorFee,
    hook,
    hookData,
  } = paymentReq.extra || {};
  
  settlementParams = {
    salt,
    settlementRouter,
    hook,
    hookData,
    finalPayTo,
    facilitatorFee: facilitatorFee || "0",
  };
  console.log("[Payment] Step 3: Using fallback - extracted params from extra (v1 compat):", settlementParams);
}

// Destructure for use
const { salt, settlementRouter, hook, hookData, finalPayTo, facilitatorFee } = settlementParams;
```

**修改验证逻辑**:
```typescript
// Check if this is a complex settlement (with router/hook) or simple direct payment
const isComplexSettlement = !!settlementRouter;

if (isComplexSettlement && (!salt || !finalPayTo || !hook || !hookData)) {
  console.error("[Payment] Missing settlement parameters:", {
    hasSalt: !!salt,
    hasFinalPayTo: !!finalPayTo,
    hasHook: !!hook,
    hasHookData: !!hookData,
    extensionInfo: paymentResponse.extensions?.["x402x-router-settlement"]?.info,
    extra: paymentReq.extra,
  });
  throw new Error("Missing required settlement parameters in payment requirements");
}
```

**修改 commitment 计算**:
```typescript
if (isComplexSettlement) {
  const commitmentParams = {
    chainId,
    hub: settlementRouter!,
    asset: paymentReq.asset,
    from,
    value,
    validAfter,
    validBefore,
    salt: salt!,
    payTo: finalPayTo!,
    facilitatorFee: facilitatorFee || "0",
    hook: hook!,
    hookData: hookData!,
  };

  // Validate parameters before calculating commitment
  validateCommitmentParams(commitmentParams);

  nonce = calculateCommitment(commitmentParams) as Hex;
  
  // ... rest of the logic
}
```

### 3. 类型定义更新

#### 3.1 `typescript/packages/core_v2/src/types.ts` (如果存在)

更新 `RouterSettlementInfo` 接口：

```typescript
export interface RouterSettlementInfo {
  schemaVersion: number;
  description?: string;
  salt: string;                    // 动态生成
  settlementRouter: string;        // Settlement router 地址
  hook: string;                    // Hook 合约地址
  hookData: string;                // Hook 数据
  finalPayTo: string;              // 最终收款人（merchant）
  facilitatorFee?: string;         // Facilitator 费用
}

export interface RouterSettlementDeclaration {
  info: Partial<RouterSettlementInfo>; // Partial because salt is added dynamically
  schema?: object;
}
```

### 4. Facilitator 端

#### 4.1 验证逻辑更新

如果 facilitator 有验证 settlement 参数的逻辑，需要更新从 extensions 读取：

**当前**: 可能从 `paymentRequirements.extra` 读取
**目标**: 从 `paymentPayload.extensions['x402x-router-settlement'].info` 读取

**注意**: 根据 v2 规范，client 必须 echo server 提供的 extensions.info，所以 facilitator 应该从 `PaymentPayload.extensions` 获取这些参数。

## 测试验证

### 1. 单元测试
- [ ] 测试 `createSettlementRouteConfig` 生成的结构符合 v2 标准
- [ ] 测试 `enrichDeclaration` 正确注入 salt
- [ ] 测试 client 能正确解析新格式
- [ ] 测试 client 的向后兼容（v1 fallback）

### 2. 集成测试
- [ ] 启动 server，验证 PaymentRequired 响应格式
  ```bash
  curl -s -X POST http://localhost:3000/api/purchase-download \
    -H "Content-Type: application/json" \
    -d '{"contentId":"x402-whitepaper"}' | \
    jq '.accepts[0].extra, .extensions["x402x-router-settlement"]'
  ```
  
  **期望输出**:
  ```json
  // accepts[0].extra - 只包含 EIP-712 参数
  {
    "name": "USDC",
    "version": "2"
  }
  
  // extensions - 包含所有 settlement 参数
  {
    "x402x-router-settlement": {
      "info": {
        "schemaVersion": 1,
        "salt": "0x...",
        "settlementRouter": "0x...",
        "hook": "0x...",
        "hookData": "0x...",
        "finalPayTo": "0x...",
        "facilitatorFee": "0"
      },
      "schema": { /* ... */ }
    }
  }
  ```

- [ ] 端到端支付流程测试（需要有测试环境和测试账户）

### 3. 回归测试
- [ ] 确保现有的 showcase 功能正常工作
- [ ] 测试 commitment 计算正确
- [ ] 测试 facilitator verify/settle 正常

## 注意事项

### 1. 向后兼容性

Client 必须支持两种格式：
- **v2 新格式**: 从 `extensions` 读取 settlement 参数
- **v1/旧格式**: 从 `extra` 读取（fallback）

```typescript
// v2 优先
if (x402Version === 2 && paymentResponse.extensions?.["x402x-router-settlement"]?.info) {
  // 从 extensions 读取
} else {
  // Fallback: 从 extra 读取
}
```

### 2. Schema 定义

添加完整的 JSON Schema 以便客户端验证：
- 类型定义
- 格式验证（如地址格式 `^0x[a-fA-F0-9]{40}$`）
- 必填字段

### 3. 命名一致性

- `finalPayTo` vs `payTo`: 在 extensions 中使用 `finalPayTo` 以区分 `accepts[].payTo`（指向 router）

### 4. 文档更新

完成后需要更新：
- [ ] `docs/m2-client-update.md` - 更新架构说明
- [ ] `examples/showcase/client/src/code-examples/premium-download-*.ts` - 更新示例代码
- [ ] API 文档（如果有）

## 优先级和范围

### 必须修改（P0）
1. `typescript/packages/core_v2/src/settlement-routes.ts` - 修改 `createSettlementRouteConfig`
2. `typescript/packages/core_v2/src/server-extension.ts` - 确认 `enrichDeclaration` 正确
3. `examples/showcase/client/src/hooks/usePayment.ts` - 修改参数提取逻辑

### 建议修改（P1）
1. 添加 JSON Schema 定义
2. 更新类型定义
3. 添加单元测试

### 可选（P2）
1. Facilitator 验证逻辑更新（如果已经有从 extensions 读取的能力，可能不需要改）
2. 文档更新

## 预期收益

1. **符合规范**: 完全遵循 x402 v2 标准
2. **语义清晰**: scheme-specific vs extension-specific 分离明确
3. **可扩展性**: 为未来添加其他 extensions 奠定基础
4. **互操作性**: 与其他符合 v2 标准的实现兼容

## 参考资料

- x402 v2 规范: `deps/x402_upstream_main/specs/x402-specification-v2.md`
- 当前实现: 
  - Server: `typescript/packages/core_v2/src/settlement-routes.ts`
  - Client: `examples/showcase/client/src/hooks/usePayment.ts`
- M2 迁移文档: `docs/m2-client-update.md`

