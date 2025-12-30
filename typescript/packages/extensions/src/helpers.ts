/**
 * Helper functions for x402x router settlement integration
 *
 * Provides convenient utilities for working with x402 v2 resource servers
 * and router settlement extensions.
 */

import type { x402ResourceServer } from "@x402/core/server";
import type { PaymentRequirements, SchemeNetworkFacilitator } from "@x402/core/types";

import { generateSalt } from "./commitment.js";
import { createRouterSettlementExtension, getRouterSettlementExtensionKey } from "./extensions.js";
import type { FacilitatorConfig } from "./facilitator-types.js";
import { getNetworkConfig } from "./networks.js";
import { registerRouterSettlement as registerExtension } from "./server-extension.js";
import type { SettlementExtra } from "./types.js";

/**
 * Register router settlement extension with a resource server
 *
 * @param server - x402ResourceServer instance
 * @returns The server instance for chaining
 *
 * @example
 * ```typescript
 * import { x402ResourceServer } from "@x402/core/server";
 * import { registerExactEvmScheme } from "@x402/evm/exact/server/register";
 * import { registerRouterSettlement } from "@x402x/extensions";
 *
 * const server = new x402ResourceServer(facilitatorClient);
 * registerExactEvmScheme(server, {});
 * registerRouterSettlement(server);
 * ```
 */
export function registerRouterSettlement(server: x402ResourceServer): x402ResourceServer {
  return registerExtension(server);
}

/**
 * Create a router settlement facilitator
 *
 * Factory function to create a RouterSettlementFacilitator instance.
 *
 * Note: This requires @x402x/facilitator-sdk to be installed separately.
 *
 * @param config - Facilitator configuration
 * @returns RouterSettlementFacilitator instance
 *
 * @example
 * ```typescript
 * // First install the dependency:
 * // pnpm install @x402x/facilitator-sdk
 *
 * import { createX402xFacilitator } from "@x402x/extensions";
 * // Or import directly:
 * // import { createRouterSettlementFacilitator } from "@x402x/facilitator-sdk";
 *
 * const facilitator = createX402xFacilitator({
 *   privateKey: process.env.FACILITATOR_PRIVATE_KEY,
 *   rpcUrls: {
 *     "base-sepolia": "https://sepolia.base.org",
 *   },
 *   allowedRouters: {
 *     "base-sepolia": ["0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb"],
 *   },
 * });
 * ```
 */
export async function createX402xFacilitator(
  config: FacilitatorConfig,
): Promise<SchemeNetworkFacilitator> {
  // Dynamic import to avoid hard dependency
  // Using Function constructor to avoid static analysis during build
  try {
    const importFn = new Function("specifier", "return import(specifier)");
    const facilitatorModule = (await importFn("@x402x/facilitator-sdk")) as {
      createRouterSettlementFacilitator: (config: FacilitatorConfig) => SchemeNetworkFacilitator;
    };
    return facilitatorModule.createRouterSettlementFacilitator(config);
  } catch (error) {
    throw new Error(
      "createX402xFacilitator requires @x402x/facilitator-sdk to be installed. " +
        "Please install it using your package manager.",
    );
  }
}

/**
 * Options for adding router settlement parameters
 */
export interface WithRouterSettlementOptions {
  /** Hook contract address (required) */
  hook: string;
  /** Encoded hook data (required) */
  hookData: string;
  /** Facilitator fee amount in atomic units (required) */
  facilitatorFee: string;
  /** Final recipient address (required) */
  payTo: string;
  /** Unique salt for idempotency (optional, will be auto-generated if not provided) */
  salt?: string;
  /** Asset name for EIP-712 (optional, will use network config default if not provided) */
  name?: string;
  /** Asset version for EIP-712 (optional, will use network config default if not provided) */
  version?: string;
}

/**
 * Add router settlement parameters to PaymentRequirements
 *
 * Enriches payment requirements with settlement router extra fields needed
 * for atomic settlement through the SettlementRouter contract.
 *
 * @param requirements - Base payment requirements from x402 middleware
 * @param options - Router settlement options
 * @returns Enhanced payment requirements with settlement extra
 *
 * @example
 * ```typescript
 * import { withRouterSettlement, TransferHook } from "@x402x/extensions";
 *
 * const baseRequirements = {
 *   scheme: "exact",
 *   network: "eip155:84532",
 *   asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
 *   amount: "1000000", // 1 USDC
 *   payTo: merchantAddress,
 * };
 *
 * const requirements = withRouterSettlement(baseRequirements, {
 *   hook: TransferHook.getAddress("base-sepolia"),
 *   hookData: TransferHook.encode(),
 *   facilitatorFee: "10000", // 0.01 USDC
 *   payTo: merchantAddress,
 * });
 * ```
 */
export function withRouterSettlement(
  requirements: Partial<PaymentRequirements>,
  options: WithRouterSettlementOptions,
): PaymentRequirements {
  // Validate required fields
  if (!requirements.network) {
    throw new Error("Network is required in payment requirements");
  }

  if (!requirements.asset) {
    throw new Error("Asset is required in payment requirements");
  }

  // Get network configuration
  const networkConfig = getNetworkConfig(requirements.network);
  if (!networkConfig) {
    throw new Error(`Network configuration not found for network: ${requirements.network}`);
  }

  // Generate salt if not provided
  const salt = options.salt || generateSalt();

  // Build settlement extra with EIP-712 domain info
  const settlementExtra: SettlementExtra = {
    settlementRouter: networkConfig.settlementRouter,
    salt,
    payTo: options.payTo,
    facilitatorFee: options.facilitatorFee,
    hook: options.hook,
    hookData: options.hookData,
    name: options.name || networkConfig.defaultAsset.eip712.name,
    version: options.version || networkConfig.defaultAsset.eip712.version,
  };

  // Create extension declaration
  const extensionKey = getRouterSettlementExtensionKey();
  const extensionDeclaration = createRouterSettlementExtension({
    description: "Router settlement with atomic fee distribution",
  });

  // Merge with existing requirements
  const reqWithExtensions = requirements as any;
  return {
    ...requirements,
    extra: {
      ...(reqWithExtensions.extra || {}),
      ...settlementExtra,
    },
    extensions: {
      ...(reqWithExtensions.extensions || {}),
      [extensionKey]: extensionDeclaration,
    },
  } as PaymentRequirements;
}

/**
 * Check if payment requirements use router settlement mode
 *
 * @param requirements - Payment requirements to check
 * @returns True if router settlement is enabled
 *
 * @example
 * ```typescript
 * if (isRouterSettlement(requirements)) {
 *   console.log("Using router settlement mode");
 * }
 * ```
 */
export function isRouterSettlement(requirements: PaymentRequirements): boolean {
  return !!(requirements.extra && "settlementRouter" in requirements.extra);
}
