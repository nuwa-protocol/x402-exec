/**
 * Settlement Routes Helper
 * 
 * Provides utilities for creating route configurations with router settlement support.
 * This module bridges the gap between x402 v2 official SDK's RoutesConfig and x402x
 * settlement requirements.
 * 
 * Key Design: Use AssetAmount with x402x default assets to bypass official SDK's hardcoded default asset table.
 */

import type { x402ResourceServer } from "@x402/core/server";
import type { PaymentRequirements } from "@x402/core/types";
import { createExtensionDeclaration } from "./server-extension.js";
import { getNetworkConfig } from "./networks.js";
import { generateSalt } from "./commitment.js";
import { TransferHook } from "./hooks/index.js";
import { ROUTER_SETTLEMENT_KEY } from "./server-extension.js";

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
 * Enhanced to support dynamic price generation with x402x assets
 */
export interface SettlementPaymentOption {
  scheme: string;
  network: string;
  payTo: string | ((context: unknown) => string | Promise<string>);
  price: string | number | AssetAmount | ((context: unknown) => string | number | AssetAmount | Promise<string | number | AssetAmount>);
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}

/**
 * AssetAmount type from @x402/core
 * Represents explicit asset/amount specification bypassing default asset lookup
 */
export interface AssetAmount {
  asset: string;
  amount: string;
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
  /** Facilitator fee amount (optional, will be dynamically calculated by facilitator if not provided) */
  facilitatorFee?: string;
  /** Final recipient address (optional, defaults to original option.payTo before settlementRouter override) */
  finalPayTo?: string;
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
 * Key Design (v2 + x402x):
 * - Converts Money price to AssetAmount using x402x default asset config per network
 * - Generates unique salt per request per option
 * - Embeds EIP-712 domain + x402x settlement info into price.extra
 * - This bypasses official SDK's hardcoded getDefaultAsset() and allows x402x to define assets for all networks
 * 
 * @param baseConfig - Base route configuration (accepts can use Money price like "$1.00")
 * @param settlementOptions - Settlement-specific options (all fields optional with sensible defaults)
 * @returns Enhanced route configuration with AssetAmount prices containing full x402x context
 * 
 * @example Minimal usage (all defaults)
 * ```typescript
 * const routes = {
 *   "POST /api/purchase": createSettlementRouteConfig({
 *     accepts: supportedNetworks.map(network => ({
 *       scheme: "exact",
 *       network,
 *       payTo: merchantAddress, // Used as finalPayTo, overridden to settlementRouter
 *       price: "$1.00",
 *     })),
 *     description: "Purchase endpoint",
 *   })
 * };
 * ```
 * 
 * @example With custom options
 * ```typescript
 * const routes = {
 *   "POST /api/purchase": createSettlementRouteConfig({
 *     accepts: [...],
 *     description: "Purchase endpoint",
 *   }, {
 *     finalPayTo: customMerchantAddress, // Override the finalPayTo
 *     facilitatorFee: "1000", // Fixed fee in token's smallest unit
 *     hook: customHookAddress,
 *     hookData: customHookData,
 *   })
 * };
 * ```
 */
export function createSettlementRouteConfig(
  baseConfig: SettlementRouteConfig,
  settlementOptions?: SettlementOptions,
): SettlementRouteConfig {
  // Normalize accepts to array
  const acceptsArray = Array.isArray(baseConfig.accepts) 
    ? baseConfig.accepts 
    : [baseConfig.accepts];

  // Enhance each payment option with its own network-specific settlement extension
  const enhancedAccepts = acceptsArray.map((option) => {
    const network = typeof option.network === "string" ? option.network : option.network;
    const optionNetworkConfig = getNetworkConfig(network);
    if (!optionNetworkConfig) {
      throw new Error(`Network configuration not found for: ${network}`);
    }

    // Resolve original payTo (before settlementRouter override)
    const originalPayTo = typeof option.payTo === 'string' ? option.payTo : undefined;
    
    // Use finalPayTo from options, or fallback to original payTo
    const finalPayTo = settlementOptions?.finalPayTo || originalPayTo;
    if (!finalPayTo) {
      throw new Error(`Cannot determine finalPayTo: neither settlementOptions.finalPayTo nor option.payTo (string) is provided for network ${network}`);
    }

    // Resolve hook address (default to TransferHook for this network)
    const hook = settlementOptions?.hook || TransferHook.getAddress(network);
    const hookData = settlementOptions?.hookData || TransferHook.encode();

    // Generate unique salt for this option (will be regenerated per request via dynamic function)
    const salt = generateSalt();

    // Create network-specific settlement extension with salt
    const settlementExtension = createExtensionDeclaration({
      description: settlementOptions?.description || "Router settlement with atomic fee distribution",
      settlementRouter: optionNetworkConfig.settlementRouter,
      hook,
      hookData,
      finalPayTo,
      // Only include facilitatorFee if explicitly provided (undefined = let facilitator calculate)
      facilitatorFee: settlementOptions?.facilitatorFee,
      salt, // Include salt in the extension
    });

    // Convert Money price to AssetAmount with x402x default asset
    // This bypasses the official SDK's hardcoded getDefaultAsset() method
    const convertPriceToAssetAmount = (moneyPrice: string | number): AssetAmount => {
      // Parse the money amount (e.g., "$1.00" -> 1.0)
      const amountStr = typeof moneyPrice === 'number' 
        ? moneyPrice.toString() 
        : moneyPrice.replace(/[^0-9.]/g, '');
      const amountFloat = parseFloat(amountStr);
      
      if (isNaN(amountFloat)) {
        throw new Error(`Invalid price format: ${moneyPrice}`);
      }

      // Get x402x default asset config for this network
      const { address, decimals, eip712 } = optionNetworkConfig.defaultAsset;

      // Convert to atomic units using x402x decimals (not hardcoded 6)
      const atomicAmount = BigInt(Math.floor(amountFloat * (10 ** decimals))).toString();

      // Return AssetAmount with all context embedded in extra
      return {
        asset: address,
        amount: atomicAmount,
        extra: {
          // EIP-712 domain parameters (scheme-specific for signing)
          name: eip712.name,
          version: eip712.version,
          // Network-specific settlement extension parameters (per-option x402x declaration with salt)
          [ROUTER_SETTLEMENT_KEY]: settlementExtension[ROUTER_SETTLEMENT_KEY],
        },
      };
    };

    // Handle both static and dynamic price
    let enhancedPrice: AssetAmount | ((context: unknown) => AssetAmount | Promise<AssetAmount>);
    
    if (typeof option.price === 'function') {
      // Wrap dynamic price function to convert result to AssetAmount
      const priceFunc = option.price; // Type narrowing
      enhancedPrice = async (context: unknown) => {
        const resolvedPrice = await priceFunc(context);
        // If already an AssetAmount, use it; otherwise convert Money to AssetAmount
        if (typeof resolvedPrice === 'object' && resolvedPrice !== null && 'asset' in resolvedPrice) {
          return resolvedPrice as AssetAmount;
        }
        return convertPriceToAssetAmount(resolvedPrice);
      };
    } else if (typeof option.price === 'object' && option.price !== null && 'asset' in option.price) {
      // Already an AssetAmount, merge our extra fields
      enhancedPrice = {
        ...option.price,
        extra: {
          ...(option.price.extra || {}),
          name: optionNetworkConfig.defaultAsset.eip712.name,
          version: optionNetworkConfig.defaultAsset.eip712.version,
          [ROUTER_SETTLEMENT_KEY]: settlementExtension[ROUTER_SETTLEMENT_KEY],
        },
      };
    } else {
      // Static Money price, convert to AssetAmount
      enhancedPrice = convertPriceToAssetAmount(option.price);
    }

    // Build enhanced option with AssetAmount price
    const enhancedOption: SettlementPaymentOption = {
      ...option,
      // Override payTo to use settlementRouter as the immediate recipient
      payTo: optionNetworkConfig.settlementRouter,
      // Use AssetAmount with x402x default asset (bypasses official SDK's getDefaultAsset)
      price: enhancedPrice,
      // Keep option.extra for any user-provided context (but primary data is now in price.extra)
      extra: option.extra,
    };

    return enhancedOption;
  });

  // For route-level extensions, we only include schema/description (no network-specific info)
  // to avoid ambiguity when multiple networks are present
  const extensions = {
    ...(baseConfig.extensions || {}),
    // Only include non-network-specific metadata at root level
    // Per-option x402x info is already in accepts[i].price.extra[ROUTER_SETTLEMENT_KEY]
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

