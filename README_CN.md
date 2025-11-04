# x402-exec

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/solidity-^0.8.20-green.svg)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/foundry-latest-red.svg)](https://getfoundry.sh/)

[English](./README.md) | 简体中文

x402X (x402-exec 的简称) 是一个为 [x402 协议](https://github.com/coinbase/x402) 设计的可编程结算框架，在原子交易中结合支付验证、基于 Hook 的业务逻辑和 Facilitator 激励。

## ✨ 特性

### x402X 的独特之处

**可编程结算与真正的原子性** - 不仅仅是支付路由，而是一个完整的结算执行框架，在单个原子交易中组合支付验证、业务逻辑执行和 Facilitator 激励。

### 🎯 核心能力

**🔌 通过 Hook 实现无限扩展性**
- 多方支付的收入分账
- 原子化的 NFT 铸造支付
- 积分奖励分发
- 任何你能想象到的自定义业务逻辑

**💰 原生 Facilitator 费用支持**
- 内置 Facilitator 费用机制，实现真正的无需许可 Facilitator
- 解决 x402 协议中的关键缺失功能
- 随时可提取累积费用
- 通过事件透明追踪费用

**⚡ 最小化集成开销**
- PaymentRequirements 中仅需 3 个额外字段
- 单次交易完成所有操作 - 无需 Multicall3 复杂性
- 客户端改动极小（仅需调整 nonce 计算）
- 向后兼容现有 x402 基础设施

**🔄 原生幂等性与可观测性**
- 通过 EIP-3009 nonce 内置重放保护
- 完整的事件日志用于对账和监控
- 基于上下文的结算追踪

### 💡 内置示例

✅ **收入分账** - 自动多方支付分配  
✅ **NFT 商务** - 原子化铸造支付与收入分账  
✅ **会员计划** - 实时积分奖励分发

### 🔐 安全设计

**多层保护**
- 密码学承诺验证防止参数篡改
- 不持币原则 - Router 余额始终为零
- 基于 OpenZeppelin 的重入保护
- CEI（检查-效果-交互）模式强制执行
- 35+ 测试用例覆盖边界情况

## 🏗️ 架构

```
Client (EIP-3009 Signature)
         ↓
    Facilitator
         ↓
   SettlementRouter ──→ Hook ──→ Recipients
         │                      (分账/发货)
         └→ Events (可观测性)
```

### Core Components

1. **SettlementRouter**：核心结算合约
   - 消费 EIP-3009 授权
   - 调用 Hook 执行业务逻辑
   - 确保原子性和幂等性

2. **ISettlementHook**：Hook 接口
   - 所有业务逻辑通过 Hook 实现
   - 完全可扩展，支持任意场景

## 📦 项目结构

```
x402-exec/
├── contracts/              # Solidity 智能合约
│   ├── src/
│   │   ├── SettlementRouter.sol    # 核心结算合约
│   │   └── interfaces/             # 合约接口
│   ├── examples/                   # Hook 示例
│   ├── script/                     # 部署脚本
│   ├── test/                       # 合约测试
│   └── docs/                       # 合约文档
├── examples/
│   ├── facilitator/                # 支持 SettlementRouter 的 Facilitator
│   └── showcase/                   # 全栈演示应用
└── docs/                           # 项目文档
```

## 🚀 快速开始

### 前置要求

```bash
# 安装 Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 克隆项目
git clone https://github.com/nuwa-protocol/x402-exec.git
cd x402-exec
```

### 构建和测试

```bash
cd contracts
forge build
forge test
```

### 部署合约

```bash
cd contracts
./deploy.sh  # 先配置 .env 文件
```

## 💡 使用示例

### Facilitator 集成

该 Facilitator 自动支持两种模式：
- **标准 x402 支付**：直接 ERC-3009 转账
- **SettlementRouter 支付**：扩展结算与 Hook 执行

查看 [Facilitator README](./examples/facilitator/README.md) 获取完整设置指南和运行说明，或查看 [Facilitator 开发指南](./contracts/docs/facilitator_guide.md) 了解如何扩展你自己的 Facilitator。

### 在线演示

查看全栈演示应用：
- **位置**：[`examples/showcase/`](./examples/showcase/)
- **场景**：收入分账、NFT 铸造、积分奖励
- **技术栈**：React + TypeScript + Viem

### Hook 示例

所有 Hook 实现都可以在 [`contracts/examples/`](./contracts/examples/) 中找到：

- **RevenueSplitHook**：多方支付分配 ([源码](./contracts/examples/revenue-split/))
- **NFTMintHook**：原子化 NFT 铸造与支付 ([源码](./contracts/examples/nft-mint/))
- **RewardHook**：会员积分分发 ([源码](./contracts/examples/reward-points/))

## 🌐 部署信息

> ⚠️ **开发状态**：正在积极开发中，尚未经过审计。仅用于演示和测试目的。

### SettlementRouter 合约

| 网络 | SettlementRouter | 状态 |
|------|------------------|------|
| Base Sepolia (测试网) | [`0x32431D4511e061F1133520461B07eC42afF157D6`](https://sepolia.basescan.org/address/0x32431D4511e061F1133520461B07eC42afF157D6) | ✅ 活跃 |
| X-Layer 测试网 | [`0x1ae0e196dc18355af3a19985faf67354213f833d`](https://www.oklink.com/xlayer-test/address/0x1ae0e196dc18355af3a19985faf67354213f833d) | ✅ 活跃 |
| Base 主网 | - | 🚧 等待审计 |
| Ethereum 主网 | - | 🚧 等待审计 |

### 在线示例

用于测试和参考的示例部署：

- **演示应用**：[https://demo.x402x.dev/](https://demo.x402x.dev/)  
  交互式演示，包含 3 种支付场景（推荐分账、NFT 铸造、积分奖励）

- **示例 Facilitator**：[https://facilitator.x402x.dev](https://facilitator.x402x.dev)  
  参考 Facilitator 实现（查看 [Facilitator 指南](./examples/facilitator/README.md)）

> 💡 **注意**：这些是示例部署。生产环境请部署你自己的 Facilitator 并根据需求进行配置。

## 📖 文档

### 开发者文档

- **[Facilitator 示例与设置](./examples/facilitator/README.md)** - 完整的 TypeScript 实现和设置指南
- **[Facilitator 开发指南](./contracts/docs/facilitator_guide.md)** - 语言无关的集成指南，用于扩展你的 Facilitator
- **[Hook 开发指南](./contracts/docs/hook_guide.md)** - 构建自定义 Hook 实现业务逻辑
- **[合约 API 文档](./contracts/docs/api.md)** - SettlementRouter 合约接口

## 🗺️ 路线图

- [x] SettlementRouter 核心合约
- [x] Hook 接口和示例
- [x] 文档和指南
- [ ] 完整测试覆盖
- [ ] Gas 优化
- [ ] 安全审计
- [ ] 主网部署

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](./CONTRIBUTING.md)。

**对于 AI 代理**：在进行任何代码更改之前，**必须阅读** [开发工作流规则](./.github/WORKFLOW.md)，其中定义了强制性的 Git 工作流实践。

## 📄 许可证

Apache-2.0 License - 详见 [LICENSE](./LICENSE)

## 🔗 相关链接

- [x402 Protocol](https://github.com/coinbase/x402)
- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [Foundry 文档](https://book.getfoundry.sh/)

