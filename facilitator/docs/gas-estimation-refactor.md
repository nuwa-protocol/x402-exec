# Gas Estimation Refactoring Plan

## 背景

当前实现的 gas 估算机制存在以下问题：

1. **职责不清晰**：`HookValidator` 既负责参数验证，又负责 gas overhead 计算
2. **接口不统一**：代码验证和 RPC 模拟走不同的代码路径，调用方需要关心实现细节
3. **配置不灵活**：无法强制所有 Hook 都使用 RPC 模拟（用于验证准确性）
4. **抽象层次混乱**：gas 估算逻辑分散在多个模块

## 核心原则

1. **统一目标**：无论代码计算还是模拟执行，都是为了估算 gas limit
2. **性能优化**：代码计算是模拟执行的**快速替代方案**，而非不同的功能
3. **接口统一**：调用方不关心实现细节，可配置切换策略

## 新设计方案

### 1. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     settlement.ts                            │
│  (调用方：只知道"我需要估算 gas"，不关心如何估算)              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              GasEstimationStrategy (统一接口)                │
│         estimateGas(params) → GasEstimationResult            │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ CodeBased    │  │ Simulation   │  │ Smart        │
│ Estimator    │  │ Estimator    │  │ Estimator    │
│              │  │              │  │ (自动选择)    │
│ (快速路径)    │  │ (准确路径)    │  │              │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │                 │                 └─→ 使用上面两者
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────────────────┐
│ HookValidator│  │ walletClient.estimateGas │
│              │  │                          │
│ - validate() │  │ (RPC 调用)                │
│ - calcGas()  │  │                          │
└──────────────┘  └──────────────────────────┘
```

### 2. 核心接口定义

#### 2.1 GasEstimationStrategy（策略接口）

```typescript
/**
 * Gas estimation strategy interface
 * All strategies provide a unified way to estimate gas for settlement transactions
 */
interface GasEstimationStrategy {
  /**
   * Estimate gas limit for a settlement transaction
   *
   * @param params - Settlement transaction parameters
   * @returns Gas estimation result with validation status
   */
  estimateGas(params: SettlementGasParams): Promise<GasEstimationResult>;

  /**
   * Strategy name for logging and metrics
   */
  readonly strategyName: string;
}

/**
 * Parameters for gas estimation
 */
interface SettlementGasParams {
  // Network and contract info
  network: string;
  hook: string;
  hookData: string;
  settlementRouter: string;
  token: string;

  // Transaction details
  from: string;
  value: bigint;
  authorization: {
    validAfter: bigint;
    validBefore: bigint;
    nonce: string;
  };
  signature: string;
  salt: string;
  payTo: string;
  facilitatorFee: bigint;
  hookAmount: bigint;

  // Clients and config
  walletClient: WalletClient;
  gasCostConfig: GasCostConfig;
  gasEstimationConfig: GasEstimationConfig;
}

/**
 * Gas estimation result
 */
interface GasEstimationResult {
  /** Estimated gas limit (safe value, ready to use) */
  gasLimit: number;

  /** Whether the transaction is valid */
  isValid: boolean;

  /** Error reason if invalid */
  errorReason?: string;

  /** Strategy used for this estimation */
  strategyUsed: "code_calculation" | "rpc_simulation";

  /** Additional metadata for logging */
  metadata?: {
    rawEstimate?: number;
    safetyMultiplier?: number;
    hookType?: string;
  };
}
```

#### 2.2 GasEstimationConfig（配置）

```typescript
interface GasEstimationConfig {
  /** Enable pre-validation before submitting transactions */
  enabled: boolean;

  /**
   * Gas estimation strategy to use:
   * - 'code': Force code-based calculation (faster, built-in hooks only)
   * - 'simulation': Force RPC simulation (slower, all hooks, most accurate)
   * - 'smart': Auto-select based on hook type (recommended)
   */
  strategy: "code" | "simulation" | "smart";

  /**
   * Enable code-based validation for built-in hooks (only affects 'smart' strategy)
   * When false, 'smart' strategy behaves like 'simulation'
   */
  codeValidationEnabled: boolean;

  /** Safety multiplier applied to RPC estimates (e.g., 1.2 = 20% buffer) */
  safetyMultiplier: number;

  /** Timeout for RPC calls in milliseconds */
  timeoutMs: number;
}
```

### 3. 策略实现

#### 3.1 CodeBasedGasEstimator（代码计算策略）

```typescript
/**
 * Code-based gas estimation strategy
 *
 * Fast path for built-in hooks - validates parameters and calculates gas
 * using code logic without RPC calls.
 *
 * Advantages:
 * - Very fast (<1ms)
 * - No RPC cost
 * - Can be dynamic (e.g., based on transfer count)
 *
 * Limitations:
 * - Only works for known built-in hooks
 * - Requires manual implementation for each hook type
 *
 * NOTE: This class is responsible for both validation AND gas calculation.
 * It uses HookValidator for validation, but calculates gas overhead itself.
 */
class CodeBasedGasEstimator implements GasEstimationStrategy {
  readonly strategyName = "code_calculation";

  async estimateGas(params: SettlementGasParams): Promise<GasEstimationResult> {
    const hookInfo = getHookTypeInfo(params.network, params.hook);

    // This strategy only supports built-in hooks
    if (!hookInfo.isBuiltIn || !hookInfo.validator) {
      throw new Error(
        `CodeBasedGasEstimator does not support hook: ${params.hook}. ` +
          `Use SimulationBasedGasEstimator or SmartGasEstimator instead.`,
      );
    }

    // Step 1: Validate hook parameters using HookValidator
    const validation = hookInfo.validator.validate(
      params.network,
      params.hook,
      params.hookData,
      params.hookAmount,
    );

    if (!validation.isValid) {
      return {
        gasLimit: 0,
        isValid: false,
        errorReason: validation.errorReason,
        strategyUsed: "code_calculation",
        metadata: { hookType: hookInfo.hookType },
      };
    }

    // Step 2: Calculate gas overhead (Estimator's responsibility)
    const hookOverhead = this.calculateHookOverhead(hookInfo.hookType, params.hookData);
    const totalGas = params.gasCostConfig.minGasLimit + hookOverhead;

    // Step 3: Apply max limit constraint
    const constrainedGas = Math.min(totalGas, params.gasCostConfig.maxGasLimit);

    return {
      gasLimit: constrainedGas,
      isValid: true,
      strategyUsed: "code_calculation",
      metadata: {
        rawEstimate: totalGas,
        hookType: hookInfo.hookType,
      },
    };
  }

  /**
   * Calculate gas overhead for a hook
   *
   * This is the Estimator's internal logic, not delegated to HookValidator.
   * Different hook types have different gas characteristics.
   *
   * @param hookType - Type of the hook
   * @param hookData - Encoded hook parameters
   * @returns Gas overhead (excluding base transaction cost)
   */
  private calculateHookOverhead(hookType: BuiltInHookType, hookData: string): number {
    switch (hookType) {
      case BuiltInHookType.Transfer:
        return this.calculateTransferHookOverhead(hookData);

      // Future built-in hooks can be added here
      // case BuiltInHookType.Swap:
      //   return this.calculateSwapHookOverhead(hookData);

      default:
        // Conservative estimate for unknown hook types
        return 100000;
    }
  }

  /**
   * Calculate gas overhead for TransferHook
   *
   * TransferHook gas cost scales with the number of recipients:
   * - Empty hookData: payTo-only transfer (minimal overhead)
   * - With recipients: base overhead + per-transfer cost
   *
   * @param hookData - Encoded transfer parameters
   * @returns Gas overhead
   */
  private calculateTransferHookOverhead(hookData: string): number {
    // Empty hookData means payTo-only transfer
    if (!hookData || hookData === "0x" || hookData === "") {
      return 15000; // Minimal overhead for simple transfer
    }

    try {
      // Decode hookData to determine transfer count
      const decoded = decodeAbiParameters(
        [{ type: "address[]" }, { type: "uint256[]" }],
        hookData as `0x${string}`,
      );

      const recipientCount = decoded[0].length;

      // Base overhead + per-transfer overhead
      const baseOverhead = 25000;
      const perTransferOverhead = 30000;
      return baseOverhead + perTransferOverhead * recipientCount;
    } catch (error) {
      // If decoding fails, use conservative estimate
      const baseOverhead = 25000;
      const perTransferOverhead = 30000;
      const averageRecipients = 3;
      return baseOverhead + perTransferOverhead * averageRecipients;
    }
  }
}
```

#### 3.2 SimulationBasedGasEstimator（RPC 模拟策略）

```typescript
/**
 * Simulation-based gas estimation strategy
 *
 * Uses RPC estimateGas to simulate transaction execution and detect reverts.
 * Works for all hooks (built-in and custom).
 *
 * Advantages:
 * - Most accurate
 * - Works for any hook
 * - Detects all failure cases
 *
 * Disadvantages:
 * - Slower (~100-200ms per call)
 * - RPC cost (may be rate-limited)
 */
class SimulationBasedGasEstimator implements GasEstimationStrategy {
  readonly strategyName = "rpc_simulation";

  async estimateGas(params: SettlementGasParams): Promise<GasEstimationResult> {
    const startTime = Date.now();

    try {
      // Prepare transaction data
      const txData = encodeFunctionData({
        abi: SETTLEMENT_ROUTER_ABI,
        functionName: "settleAndExecute",
        args: [
          params.token as Hex,
          params.from as Hex,
          params.value,
          params.authorization.validAfter,
          params.authorization.validBefore,
          params.authorization.nonce as Hex,
          params.signature as Hex,
          params.salt as Hex,
          params.payTo as Hex,
          params.facilitatorFee,
          params.hook as Hex,
          params.hookData as Hex,
        ],
      });

      // Call estimateGas with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Gas estimation timeout")),
          params.gasEstimationConfig.timeoutMs,
        );
      });

      const estimatePromise = params.walletClient.estimateGas({
        account: params.walletClient.account.address,
        to: params.settlementRouter as Address,
        data: txData,
        value: 0n,
      });

      const estimatedGas = await Promise.race([estimatePromise, timeoutPromise]);

      // Apply safety multiplier
      const safeGas = Math.floor(
        Number(estimatedGas) * params.gasEstimationConfig.safetyMultiplier,
      );

      // Apply max limit constraint
      const constrainedGas = Math.min(safeGas, params.gasCostConfig.maxGasLimit);

      const duration = Date.now() - startTime;

      return {
        gasLimit: constrainedGas,
        isValid: true,
        strategyUsed: "rpc_simulation",
        metadata: {
          rawEstimate: Number(estimatedGas),
          safetyMultiplier: params.gasEstimationConfig.safetyMultiplier,
          hookType: getHookTypeInfo(params.network, params.hook).hookType,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorReason = parseEstimateGasError(error);

      return {
        gasLimit: 0,
        isValid: false,
        errorReason,
        strategyUsed: "rpc_simulation",
        metadata: {
          hookType: getHookTypeInfo(params.network, params.hook).hookType,
        },
      };
    }
  }
}
```

#### 3.3 SmartGasEstimator（智能选择策略）

```typescript
/**
 * Smart gas estimation strategy
 *
 * Automatically selects the best strategy based on hook type:
 * - Built-in hooks → CodeBasedGasEstimator (fast path)
 * - Custom hooks → SimulationBasedGasEstimator (accurate path)
 *
 * Falls back to simulation if code estimation fails.
 */
class SmartGasEstimator implements GasEstimationStrategy {
  readonly strategyName = "smart";

  constructor(
    private codeEstimator: CodeBasedGasEstimator,
    private simulationEstimator: SimulationBasedGasEstimator,
    private config: GasEstimationConfig,
    private logger: pino.Logger,
  ) {}

  async estimateGas(params: SettlementGasParams): Promise<GasEstimationResult> {
    const hookInfo = getHookTypeInfo(params.network, params.hook);

    // Try code-based estimation for built-in hooks (if enabled)
    if (this.config.codeValidationEnabled && hookInfo.isBuiltIn && hookInfo.validator) {
      try {
        this.logger.debug(
          { network: params.network, hook: params.hook, hookType: hookInfo.hookType },
          "Using code-based gas estimation (fast path)",
        );

        return await this.codeEstimator.estimateGas(params);
      } catch (error) {
        this.logger.warn(
          { error, network: params.network, hook: params.hook },
          "Code-based estimation failed, falling back to simulation",
        );
        // Fall through to simulation
      }
    }

    // Use simulation for custom hooks or as fallback
    this.logger.debug(
      {
        network: params.network,
        hook: params.hook,
        hookType: hookInfo.hookType,
        isBuiltIn: hookInfo.isBuiltIn,
        reason: hookInfo.isBuiltIn ? "code_validation_disabled" : "custom_hook",
      },
      "Using simulation-based gas estimation",
    );

    return await this.simulationEstimator.estimateGas(params);
  }
}
```

### 4. 工厂函数

```typescript
/**
 * Create gas estimation strategy based on configuration
 */
function createGasEstimator(
  config: GasEstimationConfig,
  logger: pino.Logger,
): GasEstimationStrategy {
  const codeEstimator = new CodeBasedGasEstimator();
  const simulationEstimator = new SimulationBasedGasEstimator();

  switch (config.strategy) {
    case "code":
      logger.info("Using code-based gas estimation strategy (forced)");
      return codeEstimator;

    case "simulation":
      logger.info("Using simulation-based gas estimation strategy (forced)");
      return simulationEstimator;

    case "smart":
    default:
      logger.info(
        { codeValidationEnabled: config.codeValidationEnabled },
        "Using smart gas estimation strategy (auto-select)",
      );
      return new SmartGasEstimator(codeEstimator, simulationEstimator, config, logger);
  }
}
```

### 5. HookValidator 接口简化

```typescript
/**
 * Hook validator interface
 *
 * Responsibility: Validate hook parameters correctness
 *
 * NOTE: HookValidator does NOT calculate gas overhead.
 * Gas calculation is the responsibility of GasEstimationStrategy implementations.
 * This keeps the validator focused on a single responsibility: validation.
 */
interface HookValidator {
  /**
   * Validate hook parameters
   *
   * Pure validation logic - checks if parameters are correct
   * without any RPC calls or gas calculations.
   *
   * @param network - Network name
   * @param hookAddress - Hook contract address
   * @param hookData - Encoded hook parameters
   * @param hookAmount - Amount available for hook execution
   * @returns Validation result (only validity, no gas information)
   */
  validate(
    network: string,
    hookAddress: string,
    hookData: string,
    hookAmount: bigint,
  ): HookValidationResult;
}

/**
 * Hook validation result (simplified - no gas info)
 */
interface HookValidationResult {
  isValid: boolean;
  errorReason?: string;
}
```

### 6. 调用方使用示例

```typescript
// In settlement.ts

async function settleWithRouter(...) {
  // ... existing validation logic ...

  // Create gas estimator (can be created once at app startup and reused)
  const gasEstimator = createGasEstimator(
    config.gasEstimation,
    logger.child({ module: 'gas-estimation' }),
  );

  // Estimate gas (unified interface, don't care about implementation)
  const estimation = await gasEstimator.estimateGas({
    network,
    hook: extra.hook,
    hookData: extra.hookData,
    settlementRouter: extra.settlementRouter,
    token: asset,
    from: authorization.from,
    value: BigInt(authorization.value),
    authorization: {
      validAfter: authorization.validAfter,
      validBefore: authorization.validBefore,
      nonce: authorization.nonce,
    },
    signature,
    salt: extra.salt,
    payTo: extra.payTo,
    facilitatorFee: BigInt(extra.facilitatorFee),
    hookAmount: BigInt(authorization.value) - BigInt(extra.facilitatorFee),
    walletClient,
    gasCostConfig,
    gasEstimationConfig: config.gasEstimation,
  });

  // Handle validation failure
  if (!estimation.isValid) {
    logger.warn(
      {
        network,
        hook: extra.hook,
        errorReason: estimation.errorReason,
        strategy: estimation.strategyUsed,
      },
      'Settlement pre-validation failed, rejecting transaction'
    );
    return {
      success: false,
      errorReason: estimation.errorReason,
      transaction: '',
      network: paymentPayload.network,
      payer: authorization.from,
    };
  }

  // Use estimated gas
  logger.info(
    {
      network,
      hook: extra.hook,
      gasLimit: estimation.gasLimit,
      strategy: estimation.strategyUsed,
      metadata: estimation.metadata,
    },
    'Gas estimation successful, proceeding with transaction'
  );

  const tx = await walletClient.writeContract({
    address: extra.settlementRouter as Address,
    abi: SETTLEMENT_ROUTER_ABI,
    functionName: 'settleAndExecute',
    args: [...],
    account: walletClient.account,
    gas: BigInt(estimation.gasLimit),
    chain,
  });

  // ... rest of the logic ...
}
```

### 7. 配置示例

```env
# =====================================
# Settlement Gas Estimation
# =====================================

# Enable pre-validation before submitting transactions (default: true)
PREVALIDATION_ENABLED=true

# Gas estimation strategy (default: smart)
# - code: Force code-based calculation (fast, built-in hooks only)
# - simulation: Force RPC simulation (slow, all hooks, most accurate)
# - smart: Auto-select based on hook type (recommended)
GAS_ESTIMATION_STRATEGY=smart

# Enable code validation for built-in hooks in 'smart' mode (default: true)
# When false, 'smart' mode always uses simulation
CODE_VALIDATION_ENABLED=true

# Safety multiplier for RPC estimates (default: 1.2 = 20% buffer)
GAS_ESTIMATION_SAFETY_MULTIPLIER=1.2

# Timeout for RPC calls in milliseconds (default: 5000ms)
GAS_ESTIMATION_TIMEOUT_MS=5000
```

## 实现步骤

### Phase 1: 重构核心接口（不破坏现有功能）

1. **创建新的目录结构**：

   ```
   src/gas-estimation/
   ├── strategies/
   │   ├── base.ts              # 接口定义
   │   ├── code-based.ts        # CodeBasedGasEstimator
   │   ├── simulation.ts        # SimulationBasedGasEstimator
   │   └── smart.ts             # SmartGasEstimator
   ├── factory.ts               # createGasEstimator 工厂函数
   └── utils.ts                 # parseEstimateGasError 等工具
   ```

2. **创建新的接口定义** (`strategies/base.ts`)：

   - `GasEstimationStrategy` interface
   - `GasEstimationResult` interface
   - `SettlementGasParams` interface

3. **简化 `HookValidator` 接口** (`hook-validators/types.ts`)：

   - 移除 `validationMethod` 从 `HookValidationResult`
   - `validate()` 只返回验证结果（`isValid` 和 `errorReason`）
   - **删除** `getGasOverhead()` 方法（gas 计算移到 `CodeBasedGasEstimator`）

4. **更新 `TransferHookValidator`** (`hook-validators/transfer-hook.ts`)：

   - 移除 `getGasOverhead()` 方法
   - 保留 `validate()` 方法（只负责验证）
   - 可选：抽取 `decodeHookData()` 为独立的工具函数（供 Estimator 复用）

5. **实现三个策略类**：

   - `CodeBasedGasEstimator` - 包含 `calculateHookOverhead()` 和 `calculateTransferHookOverhead()` 私有方法
   - `SimulationBasedGasEstimator` - 复用当前的 `estimateGasForSettlement()` 逻辑
   - `SmartGasEstimator` - 自动选择策略

6. **实现工厂函数** (`factory.ts`):
   - `createGasEstimator(config, logger)` - 根据配置创建策略实例

### Phase 2: 迁移现有代码

1. **重构 `gas-estimation.ts`**（或拆分为多个文件）：

   - 保留 `parseEstimateGasError()` 工具函数（移到 `utils.ts`）
   - **删除** `estimateAndValidateSettlement()`（被策略类替代）
   - **删除** `estimateGasForSettlement()`（被 `SimulationBasedGasEstimator` 替代）
   - **删除** `calculateSafeGasLimit()`（被策略类内部使用）

2. **更新 `settlement.ts`**：

   - 在文件顶部或 app 启动时创建 `gasEstimator` 实例
   - 替换 `estimateAndValidateSettlement()` 调用为 `gasEstimator.estimateGas()`
   - 简化错误处理逻辑（统一使用 `GasEstimationResult`）
   - 更新日志输出（使用 `strategyUsed` 字段）

3. **更新配置** (`config.ts`)：

   - 添加 `strategy: 'code' | 'simulation' | 'smart'` 到 `GasEstimationConfig`
   - 添加 `GAS_ESTIMATION_STRATEGY` 环境变量解析
   - 更新 `parseGasEstimationConfig()` 函数

4. **更新依赖注入** (`routes/settle.ts`, `index.ts`)：
   - 传递 `gasEstimationConfig` 到需要的地方
   - 确保配置正确传递到 `settleWithRouter`

### Phase 3: 更新文档和测试

1. **更新 `README.md`**：

   - 添加 "Gas Estimation Strategies" 章节
   - 解释三种策略的适用场景
   - 更新配置说明（新增 `GAS_ESTIMATION_STRATEGY`）
   - 添加策略选择指南

2. **添加单元测试**：

   - `CodeBasedGasEstimator.test.ts`:
     - 测试 TransferHook 的 gas 计算（空 hookData、单个收款人、多个收款人）
     - 测试验证失败的情况
     - 测试不支持的 Hook 类型
   - `SimulationBasedGasEstimator.test.ts`:
     - Mock walletClient.estimateGas
     - 测试成功估算和安全系数应用
     - 测试 estimateGas 失败和错误解析
   - `SmartGasEstimator.test.ts`:
     - 测试内置 Hook 选择代码计算
     - 测试自定义 Hook 选择模拟
     - 测试 fallback 机制
   - `HookValidator.test.ts`:
     - 测试 TransferHook 参数验证
     - 确保 Validator 不涉及 gas 计算

3. **更新 metrics**：
   - 为所有现有 metrics 添加 `strategy_used` 标签
   - 确保向后兼容（旧的 metrics 查询仍然有效）

### Phase 4: 清理和优化

1. **代码审查**：

   - 统一命名和代码风格
   - 确保所有注释和文档都是最新的
   - 移除不再使用的代码

2. **性能测试**：

   - 对比代码计算和 RPC 模拟的响应时间
   - 测试高并发场景
   - 验证 gas 估算的准确性

3. **整理 Git 历史**：
   - Squash commits（保持清晰的提交历史）
   - 写清晰的 commit message
   - 可选：创建 migration guide

## 优势总结

### 1. 接口统一

- ✅ 调用方只看到 `GasEstimationStrategy`，不关心实现细节
- ✅ 所有策略返回相同的 `GasEstimationResult` 结构

### 2. 配置灵活

- ✅ 可以强制使用某种策略（开发环境用 `simulation` 验证，生产环境用 `smart` 优化）
- ✅ 可以通过配置禁用代码计算，全部走模拟

### 3. 职责清晰（单一职责原则）

- ✅ **`HookValidator`**: 只负责验证 Hook 参数的正确性（业务规则）
- ✅ **`CodeBasedGasEstimator`**: 负责代码计算策略，包含验证 + gas 计算
- ✅ **`SimulationBasedGasEstimator`**: 负责 RPC 模拟策略，包含验证 + gas 估算
- ✅ **`SmartGasEstimator`**: 负责策略选择和 fallback
- ✅ **`settlement.ts`**: 只知道"我需要 gas 估算"，不关心如何实现

### 4. 依赖方向正确

- ✅ `CodeBasedGasEstimator` 使用 `HookValidator`（高层依赖低层）
- ✅ `HookValidator` 不知道 gas 计算的存在（解耦）
- ✅ gas 计算逻辑封装在 Estimator 内部（私有方法）

### 5. 可测试性

- ✅ 每个策略可以独立单元测试
- ✅ `HookValidator` 可以独立测试（只测试验证逻辑）
- ✅ Mock `HookValidator` 即可测试 `CodeBasedGasEstimator` 的 gas 计算
- ✅ Mock `walletClient` 即可测试 `SimulationBasedGasEstimator`

### 6. 可扩展性

- ✅ 添加新的内置 Hook：只需在 `CodeBasedGasEstimator` 中添加 gas 计算分支
- ✅ 添加新的验证器：只需实现 `HookValidator` 接口（不涉及 gas）
- ✅ 添加新的策略：实现 `GasEstimationStrategy` 接口（如机器学习估算）
- ✅ 不影响现有代码

### 7. 向后兼容

- ✅ 默认配置 `strategy: 'smart'` 行为与当前实现一致
- ✅ Metrics 标签增加 `strategy_used`，不破坏现有 dashboard
- ✅ API 接口不变（内部重构，外部无感知）

## 性能对比

| 场景         | 当前实现            | 新设计（smart 策略）        | 改进      |
| ------------ | ------------------- | --------------------------- | --------- |
| TransferHook | 代码验证 + 静态 gas | CodeBasedGasEstimator       | 相同      |
| 自定义 Hook  | estimateGas         | SimulationBasedGasEstimator | 相同      |
| 强制模拟     | 不支持              | 配置 `strategy: simulation` | ✅ 新功能 |
| 强制代码     | 不支持              | 配置 `strategy: code`       | ✅ 新功能 |

## 职责划分详解

### 为什么 HookValidator 不负责 gas 计算？

**关注点分离（Separation of Concerns）**：

| 关注点       | HookValidator                      | CodeBasedGasEstimator               |
| ------------ | ---------------------------------- | ----------------------------------- |
| **目的**     | 验证参数是否**正确**               | 估算执行需要多少 **gas**            |
| **关心**     | 业务规则（地址格式、金额合理性等） | 计算成本（操作复杂度、链上开销）    |
| **变化原因** | 业务规则变化（如允许零地址）       | Gas 成本变化（如链的 gas 价格调整） |
| **依赖**     | 只需要参数数据                     | 需要 gas 配置和网络信息             |
| **示例**     | "收款人地址不能为空"               | "3 个收款人需要 115000 gas"         |

**代码重复的合理性**：

虽然 `HookValidator` 和 `CodeBasedGasEstimator` 都需要解析 `hookData`，但这是**合理的重复**：

- **Validator 解析**：为了检查参数的**正确性**（验证每个字段）
- **Estimator 解析**：为了计算**成本**（只关心数量/复杂度）

这种重复是**低耦合**的体现，让两个类可以独立演化。

### 未来扩展示例

#### 添加新的内置 Hook（如 SwapHook）

```typescript
// 1. 实现 SwapHook 验证器（只验证）
class SwapHookValidator implements HookValidator {
  validate(...) {
    // 验证 swap 参数：token 地址、slippage、deadline 等
    return { isValid: true };
  }
}

// 2. 在 CodeBasedGasEstimator 中添加 gas 计算
class CodeBasedGasEstimator {
  private calculateHookOverhead(hookType, hookData) {
    switch (hookType) {
      case BuiltInHookType.Transfer:
        return this.calculateTransferHookOverhead(hookData);

      case BuiltInHookType.Swap:  // 新增
        return this.calculateSwapHookOverhead(hookData);

      default:
        return 100000;
    }
  }

  private calculateSwapHookOverhead(hookData) {
    // 解析 hookData，根据 swap 类型计算 gas
    // AMM swap vs aggregator swap 的 gas 不同
    return 150000; // 示例
  }
}
```

**注意**：`SwapHookValidator` 和 `CodeBasedGasEstimator` 的 gas 计算逻辑**完全独立**，互不影响。

## 风险评估

### 低风险

- ✅ 新接口是对现有逻辑的重新组织，不改变核心算法
- ✅ 可以通过配置回退到接近当前行为的模式（`strategy: smart`）
- ✅ 保留所有现有的错误处理和 fallback 机制

### 需要注意

- ⚠️ **`HookValidator` 接口变更**：
  - 移除了 `getGasOverhead()` 方法
  - 影响：当前分支的 `TransferHookValidator` 需要删除这个方法
  - 缓解：这是简化，而非复杂化，改动量小
- ⚠️ **Metrics 标签变化**：
  - 新增 `strategy_used` 标签
  - 影响：现有 dashboard 查询可能需要更新（如果按 method 过滤）
  - 缓解：保持旧的 metrics 名称，只增加标签，向后兼容

### 测试建议

1. **准确性测试**：

   - 在测试环境使用 `strategy: simulation` 运行一段时间
   - 对比代码计算和 RPC 模拟的 gas 估算差异
   - 确保代码计算的 gas 足够（不会 Out of Gas）

2. **性能测试**：

   - 在生产环境使用 `strategy: smart` 并监控响应时间
   - 对比内置 Hook 和自定义 Hook 的处理速度
   - 验证代码计算路径确实比 RPC 快（应该 <1ms vs ~100ms）

3. **Fallback 测试**：

   - 模拟 RPC 超时/失败场景
   - 验证 `SmartGasEstimator` 的 fallback 机制
   - 确保错误日志清晰

4. **兼容性测试**：
   - 运行现有的集成测试
   - 验证 API 响应格式不变
   - 确保 metrics 向后兼容
