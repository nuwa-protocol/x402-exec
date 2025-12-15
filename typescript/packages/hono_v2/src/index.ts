/**
 * x402x Hono v2 middleware wrapper
 *
 * Provides workspace-only v2 middleware wrapper for Hono-based resource servers with settlement support.
 * Wraps official @x402/hono middleware with custom server scheme and router settlement extension.
 */

import type { Context } from "hono";
import { x402 } from "@x402/hono";
import {
  addSettlementExtra,
  getNetworkConfig,
  TransferHook,
  calculateFacilitatorFee,
  type FeeCalculationResult,
  processPriceToAtomicAmount,
  computeRoutePatterns,
  findMatchingRoute,
  toJsonSafe,
  type FacilitatorConfig,
  type Money,
  type Network,
  type PaymentPayload,
  type PaymentRequirements,
  type Resource,
} from "@x402x/core_v2";
import type { Address } from "viem";
import type { Address as SolanaAddress } from "@solana/kit";

/**
 * Interface for x402 request objects with minimum required properties
 */
export interface X402Request {
  method?: string;
  path?: string;
  url?: string;
}

/**
 * Interface for x402Response structure from official middleware
 */
export interface X402Response {
  paymentContext?: X402Context;
}

/**
 * Payment context information available to handlers via c.get('x402')
 *
 * This is an x402x extension that provides access to payment details
 * after successful verification, enabling secure business logic that
 * depends on the payer's identity or payment amount.
 */
export interface X402Context {
  /** Address of the payer (from payment signature) */
  payer: Address | SolanaAddress;

  /** Payment amount in atomic units (e.g., USDC with 6 decimals) */
  amount: string;

  /** Network where payment was made */
  network: Network;

  /** Decoded payment payload */
  payment: PaymentPayload;

  /** Matched payment requirements */
  requirements: PaymentRequirements;

  /** Settlement information (x402x specific, undefined for standard x402) */
  settlement?: {
    /** SettlementRouter address */
    router: Address;
    /** Hook contract address */
    hook: Address;
    /** Encoded hook data */
    hookData: string;
    /** Facilitator fee in atomic units */
    facilitatorFee: string;
  };
}

/**
 * x402x-specific route configuration
 */
export interface X402xRouteConfig {
  /**
   * Price for the resource. Recommended format (matches x402 official middleware):
   * - Dollar string: '$0.01', '$1.00'
   * - Number: 0.01, 1.00 (interpreted as USD)
   * - String number: '0.01', '1.00' (interpreted as USD)
   */
  price: string | Money;

  /** Network(s) to support - can be a single network or array for multi-network support */
  network: Network | Network[];

  /** Hook address - defaults to TransferHook for the network */
  hook?: string | ((network: Network) => string);

  /** Encoded hook data - defaults to empty data */
  hookData?: string | ((network: Network) => string);

  // facilitatorFee supports two modes:
  // 1. Not configured or "auto" (default) -> query from facilitator automatically
  // 2. Configured with specific value -> use static fee (backward compatible)
  facilitatorFee?: "auto" | string | Money | ((network: Network) => string | Money);

  /** Standard x402 configuration */
  config?: {
    description?: string;
    mimeType?: string;
    maxTimeoutSeconds?: number;
    resource?: Resource;
    errorMessages?: {
      paymentRequired?: string;
      invalidPayment?: string;
      noMatchingRequirements?: string;
      verificationFailed?: string;
      settlementFailed?: string;
    };
  };
}

/**
 * Routes configuration - can be:
 * 1. Simple config for all routes: X402xRouteConfig
 * 2. Per-route config: Record<string, X402xRouteConfig>
 */
export type X402xRoutesConfig = X402xRouteConfig | Record<string, X402xRouteConfig>;

/**
 * x402x v2 custom server scheme with router settlement extension
 *
 * This custom server scheme extends the official x402 server with x402x-specific
 * settlement functionality including hook execution and facilitator fee handling.
 */
class X402xCustomServerScheme {
  constructor(
    private payTo: string,
    private routes: X402xRoutesConfig,
    private facilitator?: FacilitatorConfig,
  ) {}

  /**
   * Convert x402x route config to x402 server requirements
   */
  private async convertToPaymentRequirements(
    routeConfig: X402xRouteConfig,
    method: string,
    resourceUrl: string,
  ): Promise<PaymentRequirements[]> {
    const { price, network: networkConfig, hook, hookData, facilitatorFee, config = {} } = routeConfig;
    const { description, mimeType, maxTimeoutSeconds, resource } = config;

    const paymentRequirements: PaymentRequirements[] = [];

    // Support network array
    const networks = Array.isArray(networkConfig) ? networkConfig : [networkConfig];

    for (const network of networks) {
      const atomicAmountForAsset = processPriceToAtomicAmount(price, network);
      if ("error" in atomicAmountForAsset) {
        throw new Error(atomicAmountForAsset.error);
      }
      const { maxAmountRequired: baseAmount, asset } = atomicAmountForAsset;

      const x402xConfig = getNetworkConfig(network);

      // Resolve hook and hookData (support function or string)
      const resolvedHook =
        typeof hook === "function" ? hook(network) : hook || TransferHook.getAddress(network);

      const resolvedHookData =
        typeof hookData === "function" ? hookData(network) : hookData || TransferHook.encode();

      // Resolve facilitatorFee (support function or value)
      let resolvedFacilitatorFeeRaw =
        typeof facilitatorFee === "function" ? facilitatorFee(network) : facilitatorFee;

      let resolvedFacilitatorFee: string;
      let businessAmount: string;
      let maxAmountRequired: string;

      // Check if we should dynamically query fee
      if (resolvedFacilitatorFeeRaw === undefined || resolvedFacilitatorFeeRaw === "auto") {
        // Dynamic fee calculation
        if (!this.facilitator?.url) {
          throw new Error(
            `Facilitator URL required for dynamic fee calculation. ` +
              `Please provide facilitator config in paymentMiddleware() or set static facilitatorFee.`,
          );
        }

        const feeResult = await calculateFacilitatorFee(
          this.facilitator.url,
          network,
          resolvedHook,
          resolvedHookData,
        );
        resolvedFacilitatorFee = feeResult.facilitatorFee;

        // When using dynamic fee, price is business price only
        // Total = business price + facilitator fee
        businessAmount = baseAmount;
        maxAmountRequired = (
          BigInt(businessAmount) + BigInt(resolvedFacilitatorFee)
        ).toString();
      } else if (resolvedFacilitatorFeeRaw === "0" || resolvedFacilitatorFeeRaw === 0) {
        // Explicitly set to 0
        resolvedFacilitatorFee = "0";
        businessAmount = baseAmount;
        maxAmountRequired = baseAmount;
      } else {
        // Static fee configuration
        const feeResult = processPriceToAtomicAmount(resolvedFacilitatorFeeRaw, network);
        if ("error" in feeResult) {
          throw new Error(`Invalid facilitatorFee: ${feeResult.error}`);
        }
        resolvedFacilitatorFee = feeResult.maxAmountRequired;
        businessAmount = baseAmount;
        // Total = business price + static facilitator fee
        maxAmountRequired = (BigInt(businessAmount) + BigInt(resolvedFacilitatorFee)).toString();
      }

      // Build base PaymentRequirements
      const baseRequirements: PaymentRequirements = {
        scheme: "exact",
        network,
        maxAmountRequired,
        resource: resource || (resourceUrl as Resource),
        description: description || `Payment of ${maxAmountRequired} on ${network}`,
        mimeType: mimeType || "application/json",
        payTo: x402xConfig.settlementRouter as Address, // Use SettlementRouter as payTo
        maxTimeoutSeconds: maxTimeoutSeconds || 3600,
        asset: asset.address as Address,
        outputSchema: {
          input: {
            type: "http",
            method,
            discoverable: true,
          },
        },
        extra: "eip712" in asset ? asset.eip712 : undefined,
      };

      // Add settlement extension with both business amount and facilitator fee
      const requirements = addSettlementExtra(baseRequirements, {
        hook: resolvedHook,
        hookData: resolvedHookData,
        facilitatorFee: resolvedFacilitatorFee,
        payTo: this.payTo, // Final recipient
      });

      // Add extra field to track business amount separately (optional, for transparency)
      if (resolvedFacilitatorFeeRaw === undefined || resolvedFacilitatorFeeRaw === "auto") {
        requirements.extra = {
          ...requirements.extra,
          businessAmount,
        };
      }

      paymentRequirements.push(requirements);
    }

    return paymentRequirements;
  }

  /**
   * Find matching route config for the given request
   */
  private findRouteConfig(method: string, path: string): X402xRouteConfig | null {
    // Normalize routes to per-route config
    const isSimpleConfig = "price" in this.routes && "network" in this.routes;
    const normalizedRoutes = isSimpleConfig
      ? { "*": this.routes as X402xRouteConfig }
      : (this.routes as Record<string, X402xRouteConfig>);

    // Pre-compile route patterns to regex
    const routePatterns = computeRoutePatterns(
      Object.fromEntries(
        Object.entries(normalizedRoutes).map(([pattern, config]) => [
          pattern,
          {
            price: config.price,
            network: Array.isArray(config.network) ? config.network[0] : config.network,
          },
        ]),
      ),
    );

    const matchingRoute = findMatchingRoute(routePatterns, path, method);
    if (!matchingRoute) {
      return null;
    }

    // Get the original config for this route
    const routeKey = Object.keys(normalizedRoutes).find((pattern) => {
      const [verb, pathPattern] = pattern.includes(" ") ? pattern.split(/\s+/) : ["*", pattern];
      if (verb !== "*" && verb.toUpperCase() !== method) return false;
      const regex = new RegExp(
        `^${(pathPattern || pattern)
          .replace(/[$()+.?^{|}]/g, "\\$&")
          .replace(/\*/g, ".*?")
          .replace(/\[([^\]]+)\]/g, "[^/]+")
          .replace(/\//g, "\\/")}$`,
        "i",
      );
      return regex.test(path);
    });

    return routeKey ? normalizedRoutes[routeKey] : normalizedRoutes["*"] || null;
  }

  /**
   * Get payment requirements for the request
   */
  async getPaymentRequirements(method: string, path: string, resourceUrl: string): Promise<PaymentRequirements[]> {
    const routeConfig = this.findRouteConfig(method, path);
    if (!routeConfig) {
      return [];
    }

    return this.convertToPaymentRequirements(routeConfig, method, resourceUrl);
  }

  /**
   * Extract settlement information from payment requirements
   */
  extractSettlementContext(requirements: PaymentRequirements, payment: PaymentPayload): X402Context | null {
    if (!requirements.extra) {
      return null;
    }

    const settlementInfo = requirements.extra as any;
    return {
      payer: payment.payer as Address | SolanaAddress,
      amount: requirements.maxAmountRequired,
      network: requirements.network,
      payment,
      requirements,
      settlement: {
        router: requirements.payTo as Address,
        hook: settlementInfo.hook as Address,
        hookData: settlementInfo.hookData as string,
        facilitatorFee: settlementInfo.facilitatorFee as string,
      },
    };
  }
}

/**
 * Creates a payment middleware for Hono with x402x settlement support
 *
 * This middleware wraps the official @x402/hono middleware with custom x402x
 * server scheme that provides router settlement extensions.
 *
 * @param payTo - The final recipient address (used in hook, not as SettlementRouter)
 * @param routes - Configuration for protected routes and their payment requirements
 * @param facilitator - Configuration for the payment facilitator service
 * @returns A Hono middleware handler
 *
 * @example
 * Simple usage - single network with default TransferHook:
 * ```typescript
 * import { Hono } from 'hono';
 * import { paymentMiddleware } from '@x402x/hono_v2';
 *
 * const app = new Hono();
 *
 * app.use('/api/*', paymentMiddleware(
 *   '0xRecipient...', // Final recipient
 *   {
 *     price: '$0.01',
 *     network: 'eip155:84532',
 *     // hook defaults to TransferHook
 *     // hookData defaults to empty
 *   },
 *   { url: 'https://facilitator.x402.org' }
 * ));
 * ```
 *
 * @example
 * Multi-network support:
 * ```typescript
 * app.use('/api/*', paymentMiddleware(
 *   '0xRecipient...',
 *   {
 *     price: '$0.10', // Price in USD
 *     network: ['base-sepolia', 'x-layer-testnet'], // Multiple networks!
 *   },
 *   facilitator
 * ));
 * ```
 *
 * @example
 * Custom hook configuration:
 * ```typescript
 * app.post('/api/referral', paymentMiddleware(
 *   '0xPlatform...',
 *   {
 *     price: '$0.20', // Price in USD
 *     network: 'base-sepolia',
 *     hook: '0xReferralHook...',
 *     hookData: encodeReferralData(referrer, split),
 *     facilitatorFee: '$0.02', // Fee in USD (same format as price)
 *   },
 *   facilitator
 * ));
 * ```
 *
 * @example
 * Route-specific configuration:
 * ```typescript
 * app.use(paymentMiddleware(
 *   '0xRecipient...',
 *   {
 *     '/api/basic': {
 *       price: '$0.01',
 *       network: 'base-sepolia',
 *     },
 *     'POST /api/premium': {
 *       price: '$0.10', // Price in USD
 *       network: ['base-sepolia', 'polygon'],
 *       facilitatorFee: '$0.01', // Fee in USD (same format as price)
 *     },
 *   },
 *   facilitator
 * ));
 * ```
 */
export function paymentMiddleware(
  payTo: string,
  routes: X402xRoutesConfig,
  facilitator?: FacilitatorConfig,
) {
  const customServer = new X402xCustomServerScheme(payTo, routes, facilitator);

  // Create official x402 middleware with custom server scheme
  const officialMiddleware = x402({
    server: {
      getPaymentRequirements: async (req: X402Request) => {
        const method = req.method || 'GET';
        const path = req.path || req.url || '/';
        const resourceUrl = req.url || path;

        return customServer.getPaymentRequirements(method, path, resourceUrl);
      },
      extractPaymentContext: async (req: X402Request, requirements: PaymentRequirements, payment: PaymentPayload) => {
        return customServer.extractSettlementContext(requirements, payment);
      }
    },
    facilitator: facilitator
  });

  // Return the official middleware wrapped with x402x context handling
  return async function middleware(c: Context, next: () => Promise<void>) {
    // Apply the official middleware
    await officialMiddleware(c, next);

    // Extract x402 context and set it in Hono context for x402x compatibility
    const x402Response = c.get('x402Response') as X402Response;
    if (x402Response?.paymentContext) {
      c.set('x402', x402Response.paymentContext);
    }
  };
}

// Export types for external consumers (public API types)
export type {
  Money,
  Network,
  Resource,
  FacilitatorConfig,
  PaymentPayload,
  PaymentRequirements,
} from "@x402x/core_v2";
export type { Address } from "viem";
export type { Address as SolanaAddress } from "@solana/kit";