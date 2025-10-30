# Deployment Guide

## 部署架构

x402 Settlement Extension 采用**分层部署**策略：

```
Layer 1: Core Infrastructure (contracts/)
  └── SettlementHub              # 核心结算合约（唯一通用组件）

Layer 2: Application Scenarios (examples/*/contracts/)
  └── settlement-showcase/
      ├── Scenario 1: Referral Split
      │   └── RevenueSplitHook
      ├── Scenario 2: Random NFT Mint
      │   ├── NFTMintHook
      │   └── RandomNFT
      └── Scenario 3: Points Reward
          ├── RewardHook
          └── RewardToken
```

**设计理念：**
- ✅ SettlementHub = 通用基础设施，所有应用共享
- ✅ Hooks = 业务逻辑，与具体场景绑定，按需部署
- ✅ 简化部署流程，避免不必要的合约

## 快速开始

### 一键部署脚本（推荐新手）

```bash
# 从项目根目录运行
./quickstart.sh
```

这个脚本会：
1. 检查 Foundry 是否安装
2. 生成测试钱包或使用现有钱包
3. 创建 .env 配置文件
4. 引导你获取测试代币
5. 可选：立即部署 SettlementHub

### 手动部署流程

如果你更喜欢手动控制每一步：

## 部署流程

### 第一步：部署核心合约

```bash
cd contracts

# 配置环境变量（或使用 quickstart.sh 生成）
export RPC_URL=https://sepolia.base.org
export DEPLOYER_PRIVATE_KEY=0x...
export ETHERSCAN_API_KEY=...  # 可选

# 运行部署
./deploy.sh
```

**输出示例：**
```
=== Deployment Complete ===
SettlementHub: 0x1234567890abcdef...

Save this address to your .env file:
SETTLEMENT_HUB_ADDRESS=0x1234567890abcdef...
```

**重要：保存这个地址！** 后续场景部署需要使用。

### 第二步：配置环境变量

更新项目根目录的 `.env` 文件：

```bash
# 添加部署的 SettlementHub 地址
echo "SETTLEMENT_HUB_ADDRESS=0x1234567890abcdef..." >> .env
```

完整的 `.env` 示例：

```bash
# Network Configuration
RPC_URL=https://sepolia.base.org
NETWORK=base-sepolia

# Deployer
DEPLOYER_PRIVATE_KEY=0x...

# Core Contract (from Step 1)
SETTLEMENT_HUB_ADDRESS=0x1234567890abcdef...

# Optional: For showcase
MERCHANT_ADDRESS=0x...
PLATFORM_ADDRESS=0x...

# Optional: Etherscan API Key for verification
ETHERSCAN_API_KEY=...
```

### 第三步：部署场景合约

**方式 1：从 contracts 目录部署（推荐）**

```bash
cd contracts

# 部署所有场景
./deploy-showcase.sh --all

# 或者只部署特定场景：
./deploy-showcase.sh --referral        # 推荐人分账 (revenue-split/)
./deploy-showcase.sh --nft             # NFT 铸造 (nft-mint/)
./deploy-showcase.sh --reward          # 积分奖励 (reward-points/)

# 或组合部署：
./deploy-showcase.sh --referral --reward
```

**方式 2：从 showcase 目录部署**

```bash
cd examples/settlement-showcase

# 复制配置（如果还没有）
cp ../../.env .env

# 部署（会自动调用主部署脚本）
cd contracts
./deploy.sh --all
```

**输出示例：**
```
=== Deployment Summary ===

Referral Split (revenue-split/):
  REVENUE_SPLIT_HOOK_ADDRESS=0xaaaa...

NFT Mint (nft-mint/):
  NFT_MINT_HOOK_ADDRESS=0xbbbb...
  RANDOM_NFT_ADDRESS=0xcccc...

Reward Points (reward-points/):
  REWARD_HOOK_ADDRESS=0xdddd...
  REWARD_TOKEN_ADDRESS=0xeeee...

Copy these addresses to server/.env
```

### 第四步：配置应用服务

更新 showcase 应用的配置：

```bash
cd ../server

# 创建或更新 server/.env
cat >> .env << EOF
# Scenario Contract Addresses
REVENUE_SPLIT_HOOK_ADDRESS=0xaaaa...
NFT_MINT_HOOK_ADDRESS=0xbbbb...
RANDOM_NFT_ADDRESS=0xcccc...
REWARD_HOOK_ADDRESS=0xdddd...
REWARD_TOKEN_ADDRESS=0xeeee...

# Business Configuration
MERCHANT_ADDRESS=0x...
PLATFORM_ADDRESS=0x...
EOF
```

### 第五步：启动应用

```bash
cd examples/settlement-showcase

# 安装依赖（首次）
npm run install:all

# 启动开发服务器
npm run dev
```

这会同时启动：
- 后端服务器：http://localhost:3001
- 前端应用：http://localhost:5173

## 部署脚本说明

### contracts/deploy.sh

**用途：** 部署核心 SettlementHub 合约
- ✅ 唯一的通用基础设施
- ✅ 所有应用共享
- ✅ 只需部署一次

**部署内容：**
- SettlementHub（核心合约）

### contracts/deploy-showcase.sh

**用途：** 部署 showcase 的场景合约
- ✅ 按场景独立部署
- ✅ 支持部分部署或全部部署
- ✅ Hook 与场景绑定
- ✅ 统一在 contracts 目录管理

**部署内容：**
- referral: RevenueSplitHook (examples/revenue-split/)
- nft: NFTMintHook + RandomNFT (examples/nft-mint/)
- reward: RewardHook + RewardToken (examples/reward-points/)

**命令示例：**
```bash
cd contracts
./deploy-showcase.sh --all              # 部署所有场景
./deploy-showcase.sh --referral         # 只部署 referral
./deploy-showcase.sh --nft              # 只部署 nft
./deploy-showcase.sh --reward           # 只部署 reward
./deploy-showcase.sh --referral --reward  # 部署 referral 和 reward
```

### examples/settlement-showcase/contracts/deploy.sh

**用途：** 简化的包装脚本
- ✅ 从 showcase 目录调用主部署脚本
- ✅ 保持向后兼容
- ✅ 方便开发者使用

## 网络支持

### Base Sepolia（测试网）

```bash
export RPC_URL=https://sepolia.base.org
export NETWORK=base-sepolia

# 获取测试币
# ETH: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
# USDC: https://faucet.circle.com/
```

USDC 合约地址: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

### Base Mainnet（主网）

```bash
export RPC_URL=https://mainnet.base.org
export NETWORK=base-mainnet
```

USDC 合约地址: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

⚠️ **主网部署前确保：**
- [ ] 合约已通过安全审计
- [ ] 充分的测试网测试
- [ ] 正确的权限配置
- [ ] 使用多签钱包管理特权

## 验证合约

### 自动验证（推荐）

部署时添加 `--verify` 参数（需要 `ETHERSCAN_API_KEY`）：

```bash
./deploy.sh  # 脚本内已包含 --verify
```

### 手动验证

如果自动验证失败：

```bash
forge verify-contract \
  --chain-id 84532 \
  --compiler-version v0.8.20 \
  <CONTRACT_ADDRESS> \
  src/SettlementHub.sol:SettlementHub \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

## 常见问题

### Q: 为什么改成这种部署方式？

**A:** 之前的设计将 Hooks 与核心合约一起部署，但实际上：
- ❌ RevenueSplitHook、NFTMintHook 等是 showcase 的一部分，不是通用的
- ❌ 每个应用场景的 Hook 应该与场景绑定，不应该预先部署
- ✅ 新设计：只部署 SettlementHub（真正通用的），Hooks 按场景部署

### Q: 可以只部署部分场景吗？

**A:** 可以！这正是新部署方式的优势：

```bash
# 只需要推荐分账功能
./deploy.sh --referral

# 只需要 NFT 和积分奖励
./deploy.sh --nft --reward
```

### Q: 多个示例可以共享 SettlementHub 吗？

**A:** 可以！这是核心设计：
1. 部署一次 SettlementHub
2. 多个应用/场景共享同一个 SettlementHub
3. 每个应用部署自己的 Hooks

### Q: 场景名称对应的目录？

**A:** 
- `--referral` → `contracts/examples/revenue-split/`
- `--nft` → `contracts/examples/nft-mint/`
- `--reward` → `contracts/examples/reward-points/`

### Q: 如何添加新的场景？

**A:** 
1. 在 `contracts/examples/` 下创建新目录（如 `my-scenario/`）
2. 在 showcase 的 `script/Deploy.s.sol` 中添加 `deployMyScenario()` 函数
3. 在 `deploy.sh` 中添加 `--my-scenario` 选项
4. 实现你的 Hook 合约
5. 部署：`./deploy.sh --my-scenario`

### Q: 如何更新合约？

**A:** 当前合约不可升级。如需更新：
1. 部署新版本合约
2. 更新配置文件中的地址
3. 迁移状态（如果需要）

未来可以考虑使用代理模式实现可升级合约。

### Q: 部署失败怎么办？

**常见原因：**
1. **Gas 不足** - 确保部署账户有足够的 ETH
2. **RPC 限流** - 使用付费 RPC 或重试
3. **私钥错误** - 检查 `DEPLOYER_PRIVATE_KEY` 格式
4. **网络配置** - 确认 `RPC_URL` 正确

**调试方法：**
```bash
# 增加详细输出
forge script ... -vvvv

# 模拟部署（不广播）
forge script ... --rpc-url $RPC_URL  # 不加 --broadcast
```

## 部署检查清单

### 部署前

- [ ] 已安装 Foundry (`foundryup`)
- [ ] 已配置 `.env` 文件
- [ ] 部署账户有足够的 ETH（~0.1 ETH）
- [ ] RPC URL 可访问
- [ ] 私钥格式正确（以 `0x` 开头）

### 核心合约部署后

- [ ] 保存所有合约地址
- [ ] 在区块浏览器验证部署
- [ ] 合约已验证源码
- [ ] 更新 `.env` 文件

### 示例应用部署后

- [ ] 配置文件已更新
- [ ] 合约权限已配置（minter, owner 等）
- [ ] 测试基本功能
- [ ] 文档已更新

## 下一步

部署完成后：

1. **运行测试**：`forge test`
2. **启动示例应用**：参见 [Settlement Showcase README](../examples/settlement-showcase/README.md)
3. **集成到应用**：参见 [API 文档](./docs/API.md) 和 [Hook 开发指南](./docs/HOOK_GUIDE.md)

## 相关文档

- [主 README](../README.md)
- [合约 API 文档](./docs/API.md)
- [Hook 开发指南](./docs/HOOK_GUIDE.md)
- [Settlement Showcase](../examples/settlement-showcase/README.md)

