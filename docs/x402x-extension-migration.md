# x402x Extension Migration Plan

> 将 x402x 从 wrapper SDK 模式迁移到 x402 v2 扩展模式的多阶段交付需求文档
> 
> **状态**: ✅ 已完成 (2025-12-25)

## 实施总结

迁移已完成，最终包结构：

| 包名 | 用途 | 状态 |
|------|------|------|
| `@x402x/extensions` | x402 v2 核心扩展工具库 | ✅ 已发布 |
| `@x402x/client` | Serverless 客户端 SDK | ✅ 已发布 |
| `@x402x/facilitator-sdk` | SchemeNetworkFacilitator 实现 | ✅ 完成 (workspace-only) |

所有 v1 包和 v2 wrapper 包已废弃，用户现在直接使用官方 `@x402/*` SDK + `@x402x/extensions` 扩展。

---

## 1. 背景与目标

### 1.1 当前问题

1. **v2 wrapper 模式不正确**
   - `@x402x/hono_v2`、`@x402x/express_v2`、`@x402x/fetch_v2` 等包完全重新封装了官方 middleware
   - 这违背了 "x402x 作为扩展存在" 的设计原则
   - 增加了维护成本，需要跟踪官方 SDK 的变化

2. **v1 patch 依赖需要废弃**
   - 多个包依赖 `x402@npm:@x402x/x402@^0.6.6-patch.7`
   - 这是 fork 的 patch 版本，源码在 `deps/x402/`
   - 维护 fork 版本成本高，且与官方版本脱节

3. **包结构混乱**
   - v1 包：`@x402x/core`, `@x402x/hono`, `@x402x/express`, `@x402x/fetch`
   - v2 包：`@x402x/extensions`, `@x402x/hono_v2`, `@x402x/express_v2`, `@x402x/fetch_v2`, `@x402x/facilitator-sdk`
   - 命名不一致，语义不清晰

### 1.2 目标状态

1. **x402x 作为 x402 v2 的扩展**
   - 用户直接使用官方 `@x402/hono`、`@x402/fetch` 等 SDK
   - 通过注册 x402x 扩展来获得 router settlement 功能
   - 不修改官方 SDK 代码

2. **统一的扩展包**
   - 创建 `@x402x/extensions` 包，实现所有 x402x 扩展功能
   - 提供 `ResourceServerExtension`、`SchemeNetworkFacilitator` 等标准接口实现

3. **废弃 v1 patch 依赖**
   - 移除对 `x402@npm:@x402x/x402@^0.6.6-patch.7` 的依赖
   - Facilitator 保持对 v1 协议的支持（向后兼容）

## 2. 架构设计

### 2.1 目标架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                       User Application                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  const server = new x402ResourceServer(facilitator);     │   │
│  │  registerExactEvmScheme(server, {});     // 官方 scheme  │   │
│  │  registerRouterSettlement(server);       // x402x 扩展   │   │
│  │                                                          │   │
│  │  app.use('/api/*', paymentMiddleware(routes, server));   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    x402 Official SDK                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ @x402/core  │ │ @x402/hono  │ │ @x402/fetch │ │ @x402/evm │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    x402x Core Libraries                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   @x402x/extensions                         │   │
│  │  ┌──────────────────┐  ┌──────────────────────────────┐ │   │
│  │  │ router-settlement │  │ ResourceServerExtension      │ │   │
│  │  │ extension         │  │ implementation               │ │   │
│  │  └──────────────────┘  └──────────────────────────────┘ │   │
│  │  ┌──────────────────┐  ┌──────────────────────────────┐ │   │
│  │  │ Helper Functions │  │ Network Configs              │ │   │
│  │  │ (registration)   │  │ (SettlementRouter addresses) │ │   │
│  │  └──────────────────┘  └──────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                @x402x/facilitator-sdk                     │   │
│  │  ┌──────────────────┐  ┌──────────────────────────────┐ │   │
│  │  │ SchemeNetwork    │  │ Settlement Router            │ │   │
│  │  │ Facilitator      │  │ Integration                  │ │   │
│  │  └──────────────────┘  └──────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 扩展接口设计

x402 v2 官方提供的扩展接口：

```typescript
// @x402/core/types
interface ResourceServerExtension {
  key: string;
  enrichDeclaration?: (declaration: unknown, transportContext: unknown) => unknown;
}

// @x402/core/server
class x402ResourceServer {
  registerExtension(extension: ResourceServerExtension): this;
  // ...
}
```

x402x 实现的接口（在 `@x402x/extensions` 中）：

```typescript
// @x402x/extensions
export const routerSettlementExtension: ResourceServerExtension = {
  key: "x402x-router-settlement",
  enrichDeclaration: (declaration, context) => {
    // Inject settlement router info
  }
};

export function registerRouterSettlement(server: x402ResourceServer): void;

export function createX402xFacilitator(config: X402xFacilitatorConfig): SchemeNetworkFacilitator;
```

## 3. 交付阶段

### 3.1 阶段概览

| 阶段 | 名称 | 目标 | 状态 |
|------|------|------|------|
| M1 | 创建扩展包 | 创建 `@x402x/extensions`，实现核心扩展接口 | ✅ 已完成 |
| M2 | 迁移 Showcase | 将 showcase 迁移到官方 SDK + 扩展模式 | ✅ 已完成 |
| M3 | 废弃 v2 wrapper | 删除 `hono_v2`/`express_v2`/`fetch_v2` 包 | ✅ 已完成 |
| M4 | 废弃 v1 包 | 删除 v1 包和 patch 依赖，保留 facilitator v1 支持 | ✅ 已完成 |
| M5 | 文档与清理 | 更新文档，清理 submodule | ✅ 已完成 |

### 3.2 依赖关系

```
M1 (创建扩展包)
    │
    ▼
M2 (迁移 Showcase)
    │
    ▼
M3 (废弃 v2 wrapper)
    │
    ▼
M4 (废弃 v1 包)
    │
    ▼
M5 (文档与清理)
```

## 4. 各阶段详细任务

### 4.1 M1: 创建扩展包

**目标**：创建 `@x402x/extensions` 包，实现标准的 x402 v2 扩展接口

**任务清单**：

- [ ] 创建 `typescript/packages/extensions/` 目录结构
- [ ] 从 `core_v2` 迁移核心代码：
  - [ ] 网络配置 (`networks.ts`)
  - [ ] Hook 定义 (`hooks/`)
  - [ ] Commitment 计算 (`commitment.ts`)
  - [ ] 工具函数 (`utils.ts`)
- [ ] 实现 `ResourceServerExtension`：
  - [ ] `routerSettlementExtension` - 服务端扩展
  - [ ] `enrichDeclaration` - 注入 settlement router 信息到 `PaymentRequirements.extra`
- [ ] 实现 `SchemeNetworkFacilitator`：
  - [ ] 从 `facilitator_v2` 迁移 verify/settle 逻辑
  - [ ] 支持 SettlementRouter 调用
- [ ] 实现辅助函数：
  - [ ] `registerRouterSettlement(server)` - 一键注册扩展
  - [ ] `createX402xFacilitator(config)` - 创建 facilitator 实例
- [ ] 添加单元测试
- [ ] 更新 `package.json` 依赖和导出

**输出物**：
- `@x402x/extensions` 包，可通过 npm 发布
- 完整的类型定义和 API 文档

**验收标准**：
- 所有测试通过
- 可以在新项目中独立使用 `@x402/hono` + `@x402x/extensions`

### 4.2 M2: 迁移 Showcase

**目标**：将 showcase server 迁移到使用官方 SDK + x402x 扩展

**任务清单**：

- [ ] 更新 `examples/showcase/server/package.json`：
  - [ ] 移除 `@x402x/hono` 依赖
  - [ ] 添加 `@x402/hono`、`@x402/evm` 依赖
  - [ ] 添加 `@x402x/extensions` 依赖
- [ ] 重构 `examples/showcase/server/src/index.ts`：
  - [ ] 使用 `@x402/hono` 的 `paymentMiddleware`
  - [ ] 创建 `x402ResourceServer` 实例
  - [ ] 注册 `@x402/evm` scheme
  - [ ] 注册 `@x402x/extensions` 扩展
- [ ] 更新路由配置格式适配官方 SDK
- [ ] 测试 showcase 功能正常

**输出物**：
- 迁移后的 showcase server 代码
- 验证官方 SDK + 扩展模式可行

**验收标准**：
- Showcase server 可正常启动
- 支付流程端到端测试通过

### 4.3 M3: 废弃 v2 Wrapper 包

**目标**：删除 `hono_v2`、`express_v2`、`fetch_v2` 等 wrapper 包

**任务清单**：

- [ ] 确认没有其他代码依赖这些包
- [ ] 删除以下目录：
  - [ ] `typescript/packages/hono_v2/`
  - [ ] `typescript/packages/express_v2/`
  - [ ] `typescript/packages/fetch_v2/`
- [ ] 更新 `pnpm-workspace.yaml` 移除相关包
- [ ] 更新根 `package.json` 的 workspace 配置
- [ ] 运行 `pnpm install` 更新 lockfile

**输出物**：
- 清理后的 workspace 结构

**验收标准**：
- `pnpm build` 成功
- `pnpm test` 通过

### 4.4 M4: 废弃 v1 包

**目标**：移除 v1 包和 patch 依赖，保留 facilitator 对 v1 协议的支持

**任务清单**：

- [ ] 删除 v1 SDK 包：
  - [ ] `typescript/packages/core/` (v1)
  - [ ] `typescript/packages/hono/` (v1)
  - [ ] `typescript/packages/express/` (v1)
  - [ ] `typescript/packages/fetch/` (v1)
  - [ ] `typescript/packages/react/` (if v1 only)
  - [ ] `typescript/packages/client/` (if v1 only)
- [ ] 处理 facilitator v1 支持：
  - [ ] 将 v1 验证/结算逻辑内联到 facilitator
  - [ ] 或保留 `@x402x/core` 仅供 facilitator 内部使用
- [ ] 移除 `x402@npm:@x402x/x402@^0.6.6-patch.7` 依赖：
  - [ ] 从所有 `package.json` 中移除
  - [ ] 必要时内联所需代码到 facilitator
- [ ] 更新 `pnpm-workspace.yaml`
- [ ] 运行 `pnpm install` 更新 lockfile

**输出物**：
- 清理后的包结构
- Facilitator 仍支持 v1 协议

**验收标准**：
- `pnpm build` 成功
- Facilitator 可处理 v1 和 v2 请求
- 无 `x402` patch 依赖

### 4.5 M5: 文档与清理

**目标**：更新文档，清理 submodule 和遗留文件

**任务清单**：

- [ ] 更新 README.md：
  - [ ] 更新安装说明
  - [ ] 更新使用示例
  - [ ] 添加迁移说明
- [ ] 更新/删除文档：
  - [ ] 更新 `docs/x402x-v2-plan.md`（标记为已完成或删除）
  - [ ] 更新 `docs/x402-development.md`（移除 patch 相关内容）
  - [ ] 更新 `docs/third-party-integration.md`
- [ ] 处理 submodule：
  - [ ] 评估是否可以移除 `deps/x402/`
  - [ ] 如需保留，更新相关文档说明
- [ ] 清理 CI 配置：
  - [ ] 更新测试矩阵
  - [ ] 移除 v1 包相关的 CI 步骤
- [ ] 发布 `@x402x/extensions` 到 npm

**输出物**：
- 更新后的文档
- 发布的 npm 包

**验收标准**：
- 文档准确反映当前状态
- 新用户可以按照文档成功集成

## 5. 风险与注意事项

### 5.1 向后兼容

- **Facilitator v1 支持**：必须保持对 v1 协议的支持，允许现有应用逐步迁移
- **迁移窗口**：建议保持 v1 支持 3-6 个月

### 5.2 破坏性变更

- 移除 `@x402x/hono` 等 v1 包是破坏性变更
- 需要发布迁移指南并通知现有用户

### 5.3 测试覆盖

- 确保每个阶段都有充分的测试
- 端到端测试覆盖 v1 和 v2 协议

### 5.4 依赖版本

- 确保 `@x402/*` 官方包版本兼容
- 当前使用 `@x402/core: 2.0.0`，需要跟踪官方更新

## 6. 附录

### 6.1 当前包结构

```
typescript/packages/
├── core/           # v1, 依赖 x402 patch
├── core_v2/        # v2, 依赖 @x402/core
├── hono/           # v1, 依赖 x402 patch
├── hono_v2/        # v2 wrapper, 依赖 @x402/hono
├── express/        # v1
├── express_v2/     # v2 wrapper
├── fetch/          # v1
├── fetch_v2/       # v2 wrapper
├── facilitator_v2/ # v2 facilitator
├── client/         # v1 client
└── react/          # v1 react hooks
```

### 6.2 目标包结构（已实现）

```
typescript/packages/
├── extensions/         # @x402x/extensions - x402x 扩展包
├── client/             # @x402x/client - Serverless 客户端
└── facilitator-sdk/    # @x402x/facilitator-sdk - SDK (workspace-only)
```

### 6.3 相关文件参考

- `deps/x402_upstream_main/typescript/packages/extensions/` - 官方扩展包示例
- `deps/x402_upstream_main/typescript/packages/core/src/types/extensions.ts` - 扩展接口定义
- `deps/x402_upstream_main/typescript/packages/http/hono/src/index.ts` - 官方 Hono middleware


