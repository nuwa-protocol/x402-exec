# Settlement Showcase

> 通过三个实际场景展示 x402 Settlement Extension 的核心能力

一个完整的示例应用，展示如何使用 x402 Settlement Extension 实现**支付即执行**的自动化流程。包含推荐人分账、NFT 铸造和积分奖励三个典型场景。

## 🎯 项目概述

Settlement Showcase 是一个基于 [x402 协议](https://x402.org) 和 [Settlement Extension](../../README.md) 构建的展示应用，通过三个不同的支付场景演示如何：

- **原子性操作**：支付和链上操作在一笔交易中完成
- **自动化执行**：无需人工干预，智能合约自动处理业务逻辑  
- **灵活扩展**：通过 Hook 机制支持任意场景

### 三个场景

1. **💰 Referral Split** - 推荐人分账
   - 支付 $0.1 → 自动 3 方分账（70% 商户 + 20% 推荐人 + 10% 平台）
   - 展示多方分账和动态参数传递

2. **🎨 Random NFT Mint** - 随机 NFT 铸造
   - 支付 $0.1 → 自动铸造 NFT + 转账商户
   - 展示链上 mint 操作和总量限制（1000 个）

3. **🎁 Points Reward** - 积分奖励
   - 支付 $0.1 → 自动发放 1000 积分 + 转账商户
   - 展示 ERC20 代币分发和奖励机制

## 🏗️ 技术架构

```
用户（钱包） 
    ↓ EIP-3009 签名
Facilitator
    ↓ settleAndExecute()
SettlementRouter
    ↓
Hook（RevenueSplitHook/NFTMintHook/RewardHook）
    ↓
Recipients（商户/推荐人/平台）+ NFT/Token
```

### 技术栈

- **合约**: Solidity 0.8.20 + Foundry
- **后端**: Hono + TypeScript + x402-hono
- **前端**: React + TypeScript + Vite + x402-fetch
- **网络**: Base Sepolia 测试网

## 🚀 快速开始

### 前置要求

- Node.js 18+
- Foundry ([安装指南](https://book.getfoundry.sh/getting-started/installation))
- MetaMask 或其他 Web3 钱包
- Base Sepolia 测试币（ETH 和 USDC）

### 1. 安装依赖

```bash
# 克隆项目
cd examples/settlement-showcase

# 安装所有依赖
npm run install:all
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入以下信息：
# - SETTLEMENT_HUB_ADDRESS: 已部署的 SettlementRouter 地址
# - REVENUE_SPLIT_HOOK_ADDRESS: 已部署的 RevenueSplitHook 地址
# - NFT_MINT_HOOK_ADDRESS: 已部署的 NFTMintHook 地址
# - MERCHANT_ADDRESS: 商户地址（接收支付）
# - PLATFORM_ADDRESS: 平台地址（接收分成）
# - DEPLOYER_PRIVATE_KEY: 部署者私钥（用于部署新合约）
```

### 3. 部署 Showcase 合约

```bash
cd contracts
./deploy.sh
```

部署完成后，复制输出的合约地址并更新到 `server/.env`：
- `RANDOM_NFT_ADDRESS`
- `REWARD_TOKEN_ADDRESS`
- `REWARD_HOOK_ADDRESS`

### 4. 启动服务

```bash
# 在项目根目录
npm run dev
```

这会同时启动：
- 服务器：http://localhost:3001
- 前端：http://localhost:5173

### 5. 开始使用

1. 打开浏览器访问 http://localhost:5173
2. 连接 MetaMask 钱包（确保在 Base Sepolia 网络）
3. 选择一个场景进行测试
4. 签名并支付 $0.1 USDC
5. 查看钱包，验证结果（NFT 或积分）

## 📖 详细说明

### 场景 1：Referral Split

**核心合约**: `RevenueSplitHook.sol` (已部署在主项目中)

**工作流程**:
```
1. 用户输入推荐人地址（可选）
2. 前端调用 /api/scenario-1/payment
3. 服务器生成 PaymentRequirements (含 hookData)
4. 用户签名授权 $0.1 USDC
5. SettlementRouter 调用 RevenueSplitHook
6. Hook 自动分账：
   - 70% → 商户
   - 20% → 推荐人（或平台）
   - 10% → 平台
```

**hookData 编码**:
```typescript
const splits = [
  { recipient: merchantAddress, bips: 7000 },
  { recipient: referrerAddress, bips: 2000 },
  { recipient: platformAddress, bips: 1000 }
];
const hookData = ethers.AbiCoder.encode(
  ['tuple(address recipient, uint16 bips)[]'],
  [splits]
);
```

### 场景 2: Random NFT Mint

**核心合约**: 
- `RandomNFT.sol` (新部署) - ERC721 合约，总量 1000
- `NFTMintHook.sol` (已部署)

**工作流程**:
```
1. 服务器查询当前供应量
2. 用户点击 "Mint NFT"
3. 前端调用 /api/scenario-2/payment
4. 服务器生成 PaymentRequirements (含 hookData)
5. 用户签名授权 $0.1 USDC
6. SettlementRouter 调用 NFTMintHook
7. Hook 执行：
   - mint NFT #{tokenId} → 用户
   - 转账 $0.1 USDC → 商户
```

**hookData 编码**:
```typescript
const config = {
  nftContract: randomNFTAddress,
  tokenId: nextTokenId,
  recipient: userAddress,
  merchant: merchantAddress
};
const hookData = ethers.AbiCoder.encode(
  ['tuple(address,uint256,address,address)'],
  [[config.nftContract, config.tokenId, config.recipient, config.merchant]]
);
```

### 场景 3: Points Reward

**核心合约**:
- `RewardToken.sol` (新部署) - ERC20 积分，总量 1M
- `RewardHook.sol` (新部署)

**工作流程**:
```
1. 用户点击 "Earn Points"
2. 前端调用 /api/scenario-3/payment
3. 服务器生成 PaymentRequirements (含 hookData)
4. 用户签名授权 $0.1 USDC
5. SettlementRouter 调用 RewardHook
6. Hook 执行：
   - 转账 $0.1 USDC → 商户
   - 发放 1000 Points → 用户
```

**奖励计算**:
```solidity
// 0.1 USDC = 100,000 (6 decimals)
// Reward rate = 1000 points per 0.1 USDC
uint256 rewardPoints = (amount * REWARD_RATE * 10**18) / 100_000;
// Result: 1000 * 10^18 (18 decimals)
```

## 📁 项目结构

```
settlement-showcase/
├── contracts/              # Solidity 智能合约
│   ├── src/
│   │   ├── RandomNFT.sol
│   │   ├── RewardToken.sol
│   │   └── RewardHook.sol
│   ├── script/Deploy.s.sol
│   └── deploy.sh
│
├── server/                 # Hono 后端服务
│   ├── src/
│   │   ├── index.ts        # 主服务器
│   │   ├── config.ts       # 配置加载
│   │   ├── scenarios/      # 场景处理器
│   │   │   ├── referral.ts
│   │   │   ├── nft.ts
│   │   │   └── reward.ts
│   │   └── utils/
│   │       └── hookData.ts # hookData 编码工具
│   └── package.json
│
├── client/                 # React 前端
│   ├── src/
│   │   ├── App.tsx
│   │   ├── hooks/
│   │   │   ├── useWallet.ts
│   │   │   └── usePayment.ts
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx
│   │   │   └── PaymentStatus.tsx
│   │   └── scenarios/
│   │       ├── ReferralSplit.tsx
│   │       ├── RandomNFT.tsx
│   │       └── PointsReward.tsx
│   └── package.json
│
├── package.json            # 根配置
└── README.md
```

## 🔧 开发指南

### 添加新场景

1. **创建 Hook 合约** (contracts/src/YourHook.sol)
2. **添加场景处理器** (server/src/scenarios/your-scenario.ts)
3. **添加前端组件** (client/src/scenarios/YourScenario.tsx)
4. **更新路由** (server/src/index.ts 和 client/src/App.tsx)

### 测试合约

```bash
cd contracts
forge test
```

### 本地开发

```bash
# 只启动服务器
npm run dev:server

# 只启动客户端
npm run dev:client
```

## 📊 Gas 估算

| 场景 | Gas 消耗 | 说明 |
|------|---------|------|
| Referral Split | ~120k | 1x transferWithAuthorization + 3x transfer |
| NFT Mint | ~180k | 1x transferWithAuthorization + 1x mint + 1x transfer |
| Points Reward | ~150k | 1x transferWithAuthorization + 1x ERC20 transfer + 1x transfer |

## 🧪 测试流程

### 获取测试币

1. **Base Sepolia ETH** (gas 费)
   - [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

2. **Base Sepolia USDC** (支付代币)
   - [Circle Faucet](https://faucet.circle.com/)
   - 合约地址: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

### 测试步骤

1. **场景 1**: 测试推荐人分账
   - 输入推荐人地址或留空
   - 支付 $0.1 USDC
   - 在区块浏览器验证 3 笔转账

2. **场景 2**: 测试 NFT 铸造
   - 支付 $0.1 USDC
   - 在钱包中查看 NFT（#0-#999）
   - 在 OpenSea Testnet 查看 NFT

3. **场景 3**: 测试积分奖励
   - 支付 $0.1 USDC
   - 在钱包中查看 1000 POINTS 代币
   - 导入代币地址到 MetaMask

## 🔐 安全注意事项

### 生产环境清单

- [ ] 审计所有智能合约
- [ ] 使用多签钱包管理特权地址
- [ ] 实现 Hook 白名单机制
- [ ] 添加 rate limiting
- [ ] 使用环境变量管理密钥
- [ ] 启用 HTTPS
- [ ] 实现日志和监控

### 测试网注意

- ⚠️ 本项目仅用于演示和测试
- ⚠️ 不要在测试网使用真实私钥
- ⚠️ 合约未经审计，不适合生产环境

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发规范

- **代码**: 所有代码、注释、变量名使用英文
- **文档**: README 可使用中文，代码注释使用英文
- **提交**: Commit message 使用英文

## 📄 许可证

MIT License - 详见 [LICENSE](../../LICENSE)

## 🔗 相关链接

- [x402 Protocol](https://x402.org)
- [Settlement Extension 主项目](../../README.md)
- [合约 API 文档](../../contracts/docs/API.md)
- [Hook 开发指南](../../contracts/docs/HOOK_GUIDE.md)
- [Base Sepolia 浏览器](https://sepolia.basescan.org/)

## 💬 获取帮助

- 提交 [GitHub Issue](https://github.com/nuwa-protocol/x402_settle/issues)
- 查看 [文档](../../README.md)
- 加入 [Discord 社区](#)

---

**构建下一代互联网原生支付系统** 🚀

