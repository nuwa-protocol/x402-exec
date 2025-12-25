# x402x v2 迁移与路由结算方案（分步交付版）

## 目标
- 迁移到 x402 v2（CAIP-2 network、`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE`）。
- 路由结算：用扩展 + 自定义 mechanism 实现分账/路由，不再改核心协议。
- 无 fork：最终移除 `x402` patch/alias，使用官方 npm 包 `@x402/*`。
- 分步交付：迁移期保持现有 v1 产物（showcase/facilitator/对外包）不变，先在 workspace 内完成 v2 能力闭环，最后再切换默认实现并做清理。

## 扩展
- Key：`x402x-router-settlement`
- 位置：`PaymentRequired.extensions["x402x-router-settlement"]`
- 结构：`{ info: { schemaVersion: 1, description? }, schema?: {...} }`
- Echo：客户端需回显 extensions；业务参数放 PaymentRequirements.extra。

## 业务参数（PaymentRequirements.extra）
- settlementRouter：路由合约地址
- payTo：最终商家地址
- facilitatorFee：平台/撮合费
- hook / hookData：结算钩子与数据
- name / version：EIP-712 域（资产）
- salt：客户端生成，保持 nonce/commitment 一致

## 机制实现（待接入）
- Client (SchemeNetworkClient)：若 extra 含 settlementRouter，则用 commitment + EIP-712 生成 payload；否则委托官方 exact EVM。
- Server (SchemeNetworkServer)：在 enhancePaymentRequirements 中注入上述 extra；支持通配 `eip155:*`。
- Facilitator (SchemeNetworkFacilitator)：verify/settle 调用 SettlementRouter，原子分账。

## 包拆分策略（避免 v1/v2 依赖混用）

### 背景与风险
当前仓库对 `x402` 的依赖来自 `npm:@x402x/x402@...` 的 patch 版本（import 仍为 `x402/*`）。同时引入官方 v2（`@x402/*`）时，最大的风险不是“包名冲突”，而是：
- 同一个 package 源码里混用两套类型/语义（header、network、Payment* 结构），导致隐蔽的运行时或类型问题。

官方库的 v1 兼容做法也不是“完全透明”：core/http client 对 header 有 v1/v2 分支，但 framework wrapper 侧保留了 `legacy/*` 包。
因此我们选择在 x402x 层面同样明确边界：v1 与 v2 代码拆分到不同 workspace 包里，避免混用。

### 决策（已确认）
1) `@x402x/extensions` re-export 官方 v2 类型（来自 `@x402/core/types`）。
2) v2 相关包不发布到 npm（workspace-only，`private: true`）。
3) showcase/facilitator 以及现有对外包先不变更；等 v2 能力完成后再统一切换。
4) CI 参与测试（允许 v2 包在迁移期也纳入 `pnpm -r --filter "@x402x/*" test` 的矩阵）。

### 目标依赖图（迁移期）
- v1 产物（保持不动）
  - `@x402x/core` 继续依赖 `x402` patch（允许 `import "x402/*"`）。
  - `@x402x/fetch` / `@x402x/hono` / `@x402x/express` 继续依赖 `@x402x/core` + `x402` patch。
  - showcase/facilitator 继续依赖现有 v1 产物，不修改协议头/行为。
- v2 workspace-only（新增）
  - `@x402x/extensions`：只依赖 `@x402/*`（至少 `@x402/core`）+ `viem`；严禁依赖 `x402` patch。
  - `@x402x/fetch_v2`：薄封装 `@x402/fetch` + 自定义 scheme client，依赖 `@x402x/extensions`。
  - `@x402x/hono_v2` / `@x402x/express_v2`：薄封装 `@x402/hono` / `@x402/express` + 自定义 scheme server，依赖 `@x402x/extensions`。
  -（可选）facilitator v2 实现亦可按同样方式拆分为内部包，待最终切换时接入。

### 防呆规则（强制执行）
- `*_v2` 包：禁止 `import "x402/*"`（避免把 patch 依赖传染到 v2）。
- v1 包：禁止 `import "@x402/*"`（避免在 v1 包内误用 v2 语义）。
建议用 eslint `no-restricted-imports` 在各包范围内强制。

## 依赖与协议
- v2 依赖：`@x402/core`, `@x402/fetch`, `@x402/evm`, `@x402/hono`, `@x402/express`, `@x402/extensions`。
- v2 头部：`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE`。
- v1 迁移期保持：现有 `X-PAYMENT` / `X-PAYMENT-RESPONSE`（showcase/facilitator/对外包不变更）。

## 迁移步骤（摘要）
0) 新增 `@x402x/extensions`（workspace-only），re-export `@x402/core/types`，并迁移/实现 v2 扩展 helper（`x402x-router-settlement`）与 `extra` 结构化工具。
1) 新增 `@x402x/fetch_v2`：薄封装 `@x402/fetch`，注册自定义 x402x exact EVM scheme client（router settlement 走 commitment+EIP-712，非 router 委托官方）。
2) 新增 `@x402x/hono_v2` / `@x402x/express_v2`：薄封装官方 middleware，并通过 scheme server 在 `enhancePaymentRequirements` 注入扩展 + `extra`，支持通配 `eip155:*`。
3) 新增/完善 v2 facilitator 结算机制（`SchemeNetworkFacilitator.verify/settle` 对接 SettlementRouter，原子分账）。
4) v2 闭环后：将 `@x402x/*` 默认实现切到 v2（或重导出 v2），并移除 v1 patch/alias、清理 fork/submodule 与旧文档。

## 后续测试与文档
- 增加 v2 端到端用例（client/server/facilitator，含 settlement）。
- 验证 extensions echo、分账结果、fee/hook 参数校验、network（CAIP-2）与 `eip155:*` 通配行为。
- 迁移期确保 CI 同时覆盖 v1 与新增 v2 workspace-only 包（build/test 绿灯）。
- 最终切换到 v2-only 时更新各包 README 与协议文档（包括弃用 `X-PAYMENT` 的说明）。 
