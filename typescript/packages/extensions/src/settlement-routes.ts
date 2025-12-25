/**
 * Settlement Routes Helper
 * 
 * Provides utilities for creating route configurations with router settlement support.
 * This module bridges the gap between x402 v2 official SDK's RoutesConfig and x402x
 * settlement requirements.
 */

import type { x402ResourceServer } from "@x402/core/server";
import type { PaymentRequirements } from "@x402/core/types";
import { createExtensionDeclaration } from "./server-extension.js";
import { getNetworkConfig } from "./networks.js";
import { TransferHook } from "./hooks/index.js";

/**
 * Route configuration from @x402/core
 * Re-exported for convenience with settlement prefix to avoid naming conflicts
 */
export interface SettlementRouteConfig {
  accepts: SettlementPaymentOption | SettlementPaymentOption[];
  resource?: string;
  description?: string;
  mimeType?: string;
  extensions?: Record<string, unknown>;
  unpaidResponseBody?: (context: unknown) => Promise<{ contentType: string; body: unknown }> | { contentType: string; body: unknown };
  customPaywallHtml?: string;
}

/**
 * Payment option from @x402/core
 */
export interface SettlementPaymentOption {
  scheme: string;
  network: string;
  payTo: string | ((context: unknown) => string | Promise<string>);
  price: string | ((context: unknown) => string | Promise<string>);
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}

/**
 * Settlement options for route configuration
 */
export interface SettlementOptions {
  /** Hook contract address (optional, defaults to TransferHook for the network) */
  hook?: string;
  /** Encoded hook data (optional, defaults to TransferHook.encode()) */
  hookData?: string;
  /** Facilitator fee amount (optional, will be dynamically calculated if not provided) */
  facilitatorFee?: string;
  /** Final recipient address (the actual merchant/payee) */
  finalPayTo: string;
  /** Optional description for the extension */
  description?: string;
}

/**
 * Configuration for settlement hooks
 */
export interface SettlementHooksConfig {
  /** Whether to enable automatic salt extraction from extension info */
  enableSaltExtraction?: boolean;
  /** Whether to validate settlement router parameters */
  validateSettlementParams?: boolean;
}

/**
 * Create a route configuration with router settlement support
 * 
 * This helper wraps the standard x402 RouteConfig and adds settlement-specific
 * configuration including hooks, settlement router address, and dynamic extensions.
 * 
 * The key insight: We add settlement info to the `extra` field of PaymentRequirements,
 * which gets passed through verify/settle. The extension generates dynamic salt per request.
 * 
 * @param baseConfig - Base route configuration
 * @param settlementOptions - Settlement-specific options
 * @returns Enhanced route configuration with settlement support
 * 
 * @example
 * ```typescript
 * import { createSettlementRouteConfig, TransferHook } from "@x402x/extensions";
 * 
 * const routes = {
 *   "POST /api/purchase": createSettlementRouteConfig({
 *     accepts: {
 *       scheme: "exact",
 *       network: "eip155:84532",
 *       payTo: "0x...", // Will be overridden with settlementRouter
 *       price: "$1.00",
 *     },
 *     description: "Purchase endpoint",
 *   }, {
 *     hook: TransferHook.getAddress("base-sepolia"),
 *     hookData: TransferHook.encode(),
 *     finalPayTo: "0xMerchantAddress",
 *   })
 * };
 * ```
 */
export function createSettlementRouteConfig(
  baseConfig: SettlementRouteConfig,
  settlementOptions: SettlementOptions,
): SettlementRouteConfig {
  // Normalize accepts to array
  const acceptsArray = Array.isArray(baseConfig.accepts) 
    ? baseConfig.accepts 
    : [baseConfig.accepts];

  // Store network config and settlement params for extension
  // We need to get these from the first option to pass to the extension
  const firstOption = acceptsArray[0];
  const firstNetwork = firstOption.network;
  const networkConfig = getNetworkConfig(firstNetwork);
  if (!networkConfig) {
    throw new Error(`Network configuration not found for: ${firstNetwork}`);
  }

  // Resolve hook address (default to TransferHook)
  const hook = settlementOptions.hook || TransferHook.getAddress(firstNetwork);
  const hookData = settlementOptions.hookData || TransferHook.encode();

  // Enhance each payment option - only add EIP-712 domain info to extra
  const enhancedAccepts = acceptsArray.map((option) => {
    const network = typeof option.network === "string" ? option.network : option.network;
    const optionNetworkConfig = getNetworkConfig(network);
    if (!optionNetworkConfig) {
      throw new Error(`Network configuration not found for: ${network}`);
    }

    // Only keep EIP-712 domain parameters in extra (scheme-specific)
    const enhancedOption: SettlementPaymentOption = {
      ...option,
      // Override payTo to use settlementRouter as the immediate recipient
      payTo: optionNetworkConfig.settlementRouter,
      // Only include EIP-712 domain info in extra
      extra: {
        ...(option.extra || {}),
        name: optionNetworkConfig.defaultAsset.eip712.name,
        version: optionNetworkConfig.defaultAsset.eip712.version,
      },
    };

    return enhancedOption;
  });

  // Add settlement extension to the route with all settlement parameters
  const extensions = {
    ...(baseConfig.extensions || {}),
    ...createExtensionDeclaration({
      description: settlementOptions.description || "Router settlement with atomic fee distribution",
      // Pass settlement parameters to be included in extension info
      settlementRouter: networkConfig.settlementRouter,
      hook,
      hookData,
      finalPayTo: settlementOptions.finalPayTo,
      facilitatorFee: settlementOptions.facilitatorFee || "0",
    }),
  };

  return {
    ...baseConfig,
    accepts: enhancedAccepts.length === 1 ? enhancedAccepts[0] : enhancedAccepts,
    extensions,
  };
}

/**
 * Register settlement-specific hooks with the resource server
 * 
 * This function registers lifecycle hooks for handling settlement-specific logic:
 * - Extract salt from extension info before verification
 * - Validate settlement router parameters
 * 
 * @param server - x402ResourceServer instance
 * @param config - Hook configuration options
 * 
 * @example
 * ```typescript
 * import { registerSettlementHooks } from "@x402x/extensions";
 * 
 * registerSettlementHooks(server, {
 *   enableSaltExtraction: true,
 *   validateSettlementParams: true,
 * });
 * ```
 */
export function registerSettlementHooks(
  server: x402ResourceServer,
  config: SettlementHooksConfig = {},
): void {
  const {
    enableSaltExtraction = true,
    validateSettlementParams = true,
  } = config;

  if (enableSaltExtraction) {
    // Hook to extract settlement params from PaymentPayload extensions and add to requirements.extra
    // This is needed because the facilitator currently reads from requirements.extra
    server.onBeforeVerify(async (context) => {
      const { paymentPayload, requirements } = context;
      
      // Check if payment has settlement extension
      if (paymentPayload.extensions && 
          "x402x-router-settlement" in paymentPayload.extensions) {
        const extension = paymentPayload.extensions["x402x-router-settlement"] as any;
        
        if (extension?.info) {
          // Ensure requirements.extra exists
          if (!requirements.extra) {
            (requirements as any).extra = {};
          }
          
          // Extract all settlement params from extension and add to extra
          // (for backward compatibility with facilitator that reads from extra)
          const info = extension.info;
          if (info.salt) (requirements.extra as any).salt = info.salt;
          if (info.settlementRouter) (requirements.extra as any).settlementRouter = info.settlementRouter;
          if (info.hook) (requirements.extra as any).hook = info.hook;
          if (info.hookData) (requirements.extra as any).hookData = info.hookData;
          if (info.finalPayTo) (requirements.extra as any).payTo = info.finalPayTo;
          if (info.facilitatorFee !== undefined) (requirements.extra as any).facilitatorFee = info.facilitatorFee;
        }
      }
      
      // Don't abort - continue with verification
      return undefined;
    });
  }

  if (validateSettlementParams) {
    // Hook to validate settlement router parameters before settlement
    server.onBeforeSettle(async (context) => {
      const { paymentPayload, requirements } = context;
      
      // Try to get params from extensions first (v2 standard), then fall back to extra
      let settlementParams: any = {};
      
      if (paymentPayload.extensions && "x402x-router-settlement" in paymentPayload.extensions) {
        const extension = paymentPayload.extensions["x402x-router-settlement"] as any;
        if (extension?.info) {
          settlementParams = extension.info;
        }
      }
      
      // Fallback to extra if not in extensions
      if (!settlementParams.settlementRouter && requirements.extra) {
        settlementParams = requirements.extra;
      }
      
      // Validate that required settlement fields are present
      const requiredFields = ['settlementRouter', 'hook', 'hookData'];
      const payToField = 'finalPayTo' in settlementParams ? 'finalPayTo' : 'payTo';
      const missingFields = requiredFields.filter(field => !settlementParams[field]);
      if (!settlementParams[payToField]) {
        missingFields.push(payToField);
      }
      
      if (missingFields.length > 0) {
        return {
          abort: true,
          reason: `Missing settlement parameters: ${missingFields.join(', ')}`,
        };
      }
      
      // All checks passed
      return undefined;
    });
  }
}

