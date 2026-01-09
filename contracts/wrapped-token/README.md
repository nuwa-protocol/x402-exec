# WrappedToken - ERC3009 Token Wrapper

## 概述

将任意 ERC20 代币包装成支持 EIP-3009 的代币，使其可与 x402-exec facilitator 系统配合使用。

## 已部署合约

### BSC Testnet
- **合约地址**: `0x3A278270787c18Cd3595D6eD90567d7D709c2cEf`
- **底层代币**: `0x221c5B1a293aAc1187ED3a7D7d2d9aD7fE1F3FB0`
- **名称**: x402 Wrapped
- **符号**: USDTx
- **链 ID**: 97
- **浏览器**: https://testnet.bscscan.com/address/0x3a278270787c18cd3595d6ed90567d7d709c2cef

## 功能

### 1. Wrap (包装代币)
```solidity
// 授权合约使用底层代币
IERC20(underlyingToken).approve(wrappedTokenAddress, amount);

// 包装代币
WrappedToken(wrappedTokenAddress).wrap(amount);
```

### 2. Unwrap (解包代币)
```solidity
// 直接调用解包
WrappedToken(wrappedTokenAddress).unwrap(amount);
```

### 3. ERC3009 授权转账
```solidity
// Facilitator 代表用户执行转账
wrappedToken.transferWithAuthorization(
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    signature
);
```

## 合约架构

```
ERC3009Token (基础合约)
    ↓ 继承
WrappedToken
    ↓ 使用
WrappedTokenFactory (可选)
```

### 文件结构
```
wrapped-token/
├── src/
│   ├── ERC3009Token.sol        # ERC3009 基础实现
│   ├── WrappedToken.sol         # 包装代币合约
│   └── WrappedTokenFactory.sol  # 工厂合约（可选）
├── test/
│   ├── WrappedToken.t.sol       # 测试文件
│   ├── WrappedTokenFactory.t.sol
│   └── mocks/
│       └── MockUSDC.sol
├── script/
│   └── DeployWrappedToken.s.sol # 部署脚本
└── foundry.toml
```

## 部署

### 部署到其他网络

```bash
cd contracts/wrapped-token

# 设置环境变量
export DEPLOYER_PRIVATE_KEY=0x...
export RPC_URL=<your_rpc_url>
export API_KEY=<your_api_key>

# 部署
forge script script/DeployWrappedToken.s.sol:DeployWrappedToken \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $API_KEY
```

### 修改部署参数

编辑 `script/DeployWrappedToken.s.sol`：

```solidity
// Configuration
address constant UNDERLYING_TOKEN = 0x...; // 底层代币地址
string constant TOKEN_NAME = "Your Token Name";
string constant TOKEN_SYMBOL = "SYMBOL";
```

## 使用场景

### 场景 1: 用户包装代币
```javascript
// 1. 用户授权
await underlyingToken.approve(wrappedTokenAddress, amount);

// 2. 用户包装
await wrappedToken.wrap(amount);

// 3. 用户现在持有支持 ERC3009 的包装代币
```

### 场景 2: Facilitator 执行支付
```javascript
// 1. 用户签名授权
const signature = await signTransferAuthorization({
  from: userAddress,
  to: recipientAddress,
  value: amount,
  validAfter: 0,
  validBefore: Math.floor(Date.now() / 1000) + 3600,
  nonce: commitment
});

// 2. Facilitator 执行转账
await wrappedToken.transferWithAuthorization(
  userAddress,
  recipientAddress,
  amount,
  0,
  validBefore,
  nonce,
  signature
);
```

## 测试

```bash
cd contracts/wrapped-token

# 运行所有测试
forge test

# 运行特定测试
forge test --match-contract WrappedTokenTest -vv
```

## 验证说明

如果自动验证失败，可以在 BSCScan 上手动验证：

1. 访问合约地址页面
2. 点击 "Verify and Publish"
3. 选择 "Solidity (Standard JSON Input)"
4. 上传编译配置和源代码
5. 填入构造函数参数

**编译设置**:
- Compiler: v0.8.20
- Optimization: Enabled (200 runs)
- Via IR: Enabled
- Bytecode Hash: None

## 安全特性

- ✅ 1:1 包装比例，无损失
- ✅ 使用 SafeERC20 安全转账
- ✅ EIP-712 签名验证
- ✅ 防重放攻击（nonce 管理）
- ✅ 授权过期检查
- ✅ 防抢跑保护（receiveWithAuthorization）

## License

Apache-2.0

