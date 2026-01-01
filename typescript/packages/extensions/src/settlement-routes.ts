/**
 * Settlement Routes Helper
 *
 * Provides utilities for creating route configurations with router settlement support.
 * This module bridges the gap between x402 v2 official SDK's RoutesConfig and x402x
 * settlement requirements.
 *
 * Key Design: Use AssetAmount with x402x default assets to bypass official SDK's hardcoded default asset table.
 */

import { decodePaymentSignatureHeader } from "@x402/core/http";
import type { x402ResourceServer } from "@x402/core/server";
import type { PaymentRequirements } from "@x402/core/types";

import { generateSalt } from "./commitment.js";
import { calculateFacilitatorFee } from "./facilitator.js";
import { TransferHook } from "./hooks/index.js";
import { getNetworkConfig } from "./networks.js";
import { createExtensionDeclaration } from "./server-extension.js";
import { ROUTER_SETTLEMENT_KEY } from "./server-extension.js";

/**
 * Default facilitator URL
 * Can be overridden in SettlementOptions.facilitatorUrl
 */
export const DEFAULT_FACILITATOR_URL = "https://facilitator.x402x.dev";

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
  unpaidResponseBody?: (
    context: unknown,
  ) => Promise<{ contentType: string; body: unknown }> | { contentType: string; body: unknown };
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
  price:
    | string
    | number
    | AssetAmount
    | ((
        context: unknown,
      ) => string | number | AssetAmount | Promise<string | number | AssetAmount>);
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
  /**
   * Facilitator fee amount (optional).
   * - If not provided, will be dynamically calculated by calling facilitator /calculate-fee endpoint
   * - If provided, will be used as fixed fee for all networks
   */
  facilitatorFee?: string;
  /** Final recipient address (optional, defaults to original option.payTo before settlementRouter override) */
  finalPayTo?: string;
  /** Optional description for the extension */
  description?: string;
  /**
   * Facilitator service URL for dynamic fee calculation (optional)
   * Defaults to https://facilitator.x402x.dev
   * Only used when facilitatorFee is not explicitly provided
   */
  facilitatorUrl?: string;
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
 * Validate x402 version (v2-only, v1 is deprecated)
 *
 * @param version - x402 version number
 * @throws {Error} If version is missing or not 2
 */
function validateX402Version(version?: unknown): void {
  if (version === undefined || version === null) {
    throw new Error(
      "x402Version is required. v1 is deprecated - please use x402Version=2. " +
        "See https://github.com/nuwa-protocol/x402-exec for migration guide.",
    );
  }

  if (typeof version !== "number") {
    throw new Error(`Invalid x402Version: expected number, got ${typeof version}.`);
  }

  if (version !== 2) {
    throw new Error(
      `Version not supported: x402Version ${version} is deprecated. ` +
        "Please use x402Version=2. " +
        "See https://github.com/nuwa-protocol/x402-exec for migration guide.",
    );
  }
}

/**
 * Create a route configuration with router settlement support
 *
 * This helper wraps the standard x402 RouteConfig and adds settlement-specific
 * configuration including hooks, settlement router address, and dynamic extensions.
 *
 * Key Design (v2 + x402x + dynamic fee):
 * - Uses DynamicPrice to enable probe-quote-replay flow:
 *   - First request (no payment): generates salt + queries facilitator fee → returns AssetAmount
 *   - Retry (with payment): decodes paymentPayload.accepted and replays it → ensures deepEqual match
 * - Converts Money price to AssetAmount using x402x default asset config per network
 * - Embeds EIP-712 domain + x402x settlement info into price.extra
 * - This bypasses official SDK's hardcoded getDefaultAsset() and allows x402x to define assets for all networks
 *
 * @param baseConfig - Base route configuration (accepts can use Money price like "$1.00")
 * @param settlementOptions - Settlement-specific options (all fields optional with sensible defaults)
 * @returns Enhanced route configuration with dynamic AssetAmount prices containing full x402x context
 *
 * @example Minimal usage (all defaults, dynamic fee from facilitator)
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
 *   // settlementOptions omitted: uses DEFAULT_FACILITATOR_URL for fee query
 * };
 * ```
 *
 * @example With custom facilitator URL
 * ```typescript
 * const routes = {
 *   "POST /api/purchase": createSettlementRouteConfig({
 *     accepts: [...],
 *     description: "Purchase endpoint",
 *   }, {
 *     facilitatorUrl: "https://custom-facilitator.example.com",
 *   })
 * };
 * ```
 *
 * @example With fixed facilitator fee (no dynamic query)
 * ```typescript
 * const routes = {
 *   "POST /api/purchase": createSettlementRouteConfig({
 *     accepts: [...],
 *     description: "Purchase endpoint",
 *   }, {
 *     facilitatorFee: "1000", // Fixed fee, skips dynamic calculation
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
    const originalPayTo = typeof option.payTo === "string" ? option.payTo : undefined;

    // Use finalPayTo from options, or fallback to original payTo
    const finalPayTo = settlementOptions?.finalPayTo || originalPayTo;
    if (!finalPayTo) {
      throw new Error(
        `Cannot determine finalPayTo: neither settlementOptions.finalPayTo nor option.payTo (string) is provided for network ${network}`,
      );
    }

    // Resolve hook address (default to TransferHook for this network)
    const hook = settlementOptions?.hook || TransferHook.getAddress(network);
    const hookData = settlementOptions?.hookData || TransferHook.encode();

    // Determine facilitator URL (use provided or default)
    const facilitatorUrl = settlementOptions?.facilitatorUrl || DEFAULT_FACILITATOR_URL;

    // Check if facilitatorFee is explicitly provided (fixed fee mode)
    const hasFixedFee = settlementOptions?.facilitatorFee !== undefined;

    // Create DynamicPrice function that handles both probe and retry scenarios
    const dynamicPrice = async (context: any): Promise<AssetAmount> => {
      // Check if this is a retry request (has payment header)
      const httpContext = context as { paymentHeader?: string; method?: string; adapter?: unknown };
      const isRetry = !!httpContext.paymentHeader;

      if (isRetry) {
        // === RETRY PATH: Replay accepted from client ===
        console.log("[x402x-settlement] Retry request detected, replaying accepted");

        try {
          const paymentPayload = decodePaymentSignatureHeader(httpContext.paymentHeader!);
          const accepted = paymentPayload.accepted;

          // Verify this is for the same network/scheme
          if (accepted.network === network && accepted.scheme === option.scheme) {
            console.log("[x402x-settlement] Replaying accepted for network:", network);

            // Return exactly what client sent (ensures deepEqual match)
            return {
              asset: accepted.asset,
              amount: accepted.amount,
              extra: accepted.extra,
            };
          } else {
            console.warn(
              "[x402x-settlement] Network/scheme mismatch in retry, falling back to probe",
            );
          }
        } catch (error) {
          console.error(
            "[x402x-settlement] Failed to decode payment header, falling back to probe:",
            error,
          );
        }
      }

      // === PROBE PATH: Generate salt + query fee ===
      console.log("[x402x-settlement] Probe request, generating new salt and querying fee");

      // Parse the base price
      const basePrice =
        typeof option.price === "function" ? await option.price(context) : option.price;

      let moneyPrice: string | number;
      if (typeof basePrice === "object" && basePrice !== null && "asset" in basePrice) {
        // Already an AssetAmount (shouldn't happen in normal flow, but handle it)
        return basePrice as AssetAmount;
      } else {
        moneyPrice = basePrice;
      }

      // Parse the money amount (e.g., "$1.00" -> 1.0)
      const amountStr =
        typeof moneyPrice === "number"
          ? moneyPrice.toString()
          : moneyPrice.toString().replace(/[^0-9.]/g, "");
      const amountFloat = parseFloat(amountStr);

      if (isNaN(amountFloat)) {
        throw new Error(`Invalid price format: ${moneyPrice}`);
      }

      // Get x402x default asset config for this network
      const { address, decimals, eip712 } = optionNetworkConfig.defaultAsset;

      // Convert to atomic units using x402x decimals
      const atomicAmount = BigInt(Math.floor(amountFloat * 10 ** decimals)).toString();

      // Generate fresh salt for this request
      const salt = generateSalt();

      // Query facilitator fee (if not fixed)
      let facilitatorFee: string;
      if (hasFixedFee) {
        facilitatorFee = settlementOptions!.facilitatorFee!;
        console.log("[x402x-settlement] Using fixed facilitatorFee:", facilitatorFee);
      } else {
        console.log("[x402x-settlement] Querying facilitator for fee:", {
          network,
          hook,
          hookData,
        });
        try {
          const feeResult = await calculateFacilitatorFee(facilitatorUrl, network, hook, hookData);

          if (!feeResult.hookAllowed) {
            throw new Error(`Hook not allowed by facilitator: ${hook} on network ${network}`);
          }

          facilitatorFee = feeResult.facilitatorFee;
          console.log("[x402x-settlement] Got facilitatorFee from facilitator:", facilitatorFee);
        } catch (error) {
          console.error("[x402x-settlement] Failed to query facilitator fee:", error);
          throw new Error(
            `Failed to calculate facilitator fee for network ${network}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // Create network-specific settlement extension with fresh salt and queried/fixed fee
      const settlementExtension = createExtensionDeclaration({
        description:
          settlementOptions?.description || "Router settlement with atomic fee distribution",
        settlementRouter: optionNetworkConfig.settlementRouter,
        hook,
        hookData,
        finalPayTo,
        facilitatorFee,
        salt,
      });

      // Return AssetAmount with all context embedded in extra
      return {
        asset: address,
        amount: atomicAmount,
        extra: {
          // EIP-712 domain parameters (scheme-specific for signing)
          name: eip712.name,
          version: eip712.version,
          // Network-specific settlement extension parameters (per-option x402x declaration with salt + fee)
          [ROUTER_SETTLEMENT_KEY]: settlementExtension[ROUTER_SETTLEMENT_KEY],
        },
      };
    };

    // Build enhanced option with DynamicPrice
    const enhancedOption: SettlementPaymentOption = {
      ...option,
      // Override payTo to use settlementRouter as the immediate recipient
      payTo: optionNetworkConfig.settlementRouter,
      // Use DynamicPrice that queries fee on probe and replays on retry
      price: dynamicPrice,
      // Keep option.extra for any user-provided context (primary data is now in price.extra via dynamic function)
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
  const { enableSaltExtraction = true, validateSettlementParams = true } = config;

  if (enableSaltExtraction) {
    // Hook to extract settlement params from PaymentPayload extensions and add to requirements.extra
    // This is needed because the facilitator currently reads from requirements.extra
    server.onBeforeVerify(async (context) => {
      const { paymentPayload, requirements } = context;

      // Validate x402 version (v2-only)
      validateX402Version(paymentPayload.x402Version);

      // Check if payment has settlement extension
      if (paymentPayload.extensions && "x402x-router-settlement" in paymentPayload.extensions) {
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
          if (info.settlementRouter)
            (requirements.extra as any).settlementRouter = info.settlementRouter;
          if (info.hook) (requirements.extra as any).hook = info.hook;
          if (info.hookData) (requirements.extra as any).hookData = info.hookData;
          if (info.finalPayTo) (requirements.extra as any).payTo = info.finalPayTo;
          if (info.facilitatorFee !== undefined)
            (requirements.extra as any).facilitatorFee = info.facilitatorFee;
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

      // Validate x402 version (v2-only)
      validateX402Version(paymentPayload.x402Version);

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
      const requiredFields = ["settlementRouter", "hook", "hookData"];
      const payToField = "finalPayTo" in settlementParams ? "finalPayTo" : "payTo";
      const missingFields = requiredFields.filter((field) => !settlementParams[field]);
      if (!settlementParams[payToField]) {
        missingFields.push(payToField);
      }

      if (missingFields.length > 0) {
        return {
          abort: true,
          reason: `Missing settlement parameters: ${missingFields.join(", ")}`,
        };
      }

      // All checks passed
      return undefined;
    });
  }
}
