# E2E Mock Contract Tests for v2 Stack

这个目录包含了针对 x402 v2 技术栈的模拟端到端合约测试，实现了 GitHub Issue #90 的要求。

## Issue #90 实现状态

### ✅ 已实现的功能

1. **PAYMENT-* headers 验证**
   - PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE 头部处理
   - 完整的支付流程验证（客户端 -> 服务端 -> facilitator）

2. **Extensions echo 行为**
   - 自定义扩展数据传递和回显
   - 扩展数据的正确处理

3. **eip155:* wildcard 路径支持**
   - 多网络支持的通配符路径处理
   - 网络地址解析和验证

4. **Router settlement 参数传播**
   - SettlementRouter 参数的正确传播
   - Hook data 和 facilitator fee 的处理
   - Commitment-based nonce 的验证

### 📁 测试文件

- `mock-contract.test.ts` - 完整的 HTTP 服务器模拟测试
- `mock-contract-simple.test.ts` - 简化的组件集成测试
- `README.md` - 本文档

### 🔧 技术架构

测试使用了以下组件的组合：

1. **客户端**: `@x402x/fetch_v2` - ExactEvmSchemeWithRouterSettlement
2. **服务端**: `@x402x/hono_v2` - paymentMiddleware
3. **Facilitator**: `@x402x/facilitator_v2` - RouterSettlementFacilitator
4. **Mock 组件**: viem, 区块链组件模拟

### 🏃‍♂️ 运行测试

```bash
# 运行所有 E2E 测试
pnpm test test/e2e/

# 运行特定的 E2E 测试文件
pnpm test test/e2e/mock-contract-simple.test.ts
pnpm test test/e2e/mock-contract.test.ts

# 运行所有测试（包括现有的单元测试）
pnpm test
```

### 📊 验证内容

测试验证了以下关键行为：

1. **完整的支付流程**
   - 客户端创建支付 payload
   - 服务端验证支付
   - Facilitator 执行结算

2. **Settlement Router 集成**
   - Router 地址验证
   - Hook 执行
   - Facilitator fee 处理

3. **多网络支持**
   - eip155:84532 (Base Sepolia)
   - eip155:8453 (Base Mainnet)
   - eip155:1 (Ethereum Mainnet)
   - 其他 EVM 网络

4. **错误处理**
   - 无效签名处理
   - 网络配置错误
   - SettlementRouter 地址验证

### 🎯 CI/CD 兼容性

- ✅ 无需真实区块链 RPC
- ✅ 使用 mock 的 viem 客户端
- ✅ 确定性的测试结果
- ✅ 快速执行（< 30 秒）
- ✅ 无外部依赖

### 📋 验证清单

- [x] PAYMENT-REQUIRED header 处理
- [x] PAYMENT-SIGNATURE header 验证
- [x] PAYMENT-RESPONSE header 生成
- [x] Extensions 数据 echo
- [x] eip155:* wildcard 路径
- [x] Router settlement 参数传播
- [x] 多网络支持
- [x] 错误处理和边界情况
- [x] CI 友好的 mock 环境

## 总结

Issue #90 的要求已完全实现。测试套件提供了全面的端到端验证，确保 v2 技术栈的各个组件能够正确协作，同时保持 CI/CD 环境的友好性。