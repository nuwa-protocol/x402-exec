/**
 * x402x Hono middleware
 *
 * Provides payment middleware for Hono-based resource servers with settlement support.
 * Compatible with x402 official middleware API with x402x extensions.
 */

import type { Context } from "hono";
import {
  exact,
  computeRoutePatterns,
  findMatchingPaymentRequirements,
  findMatchingRoute,
  toJsonSafe,
  useFacilitator,
  type FacilitatorConfig,
  type Money,
  type Network,
  type PaymentPayload,
  type PaymentRequirements,
  type Resource,
  moneySchema,
  settleResponseHeader,
  SupportedEVMNetworks,
} from "@x402x/core_v2";
import {
  addSettlementExtra,
  getNetworkConfig,
  TransferHook,
  calculateFacilitatorFee,
  type FeeCalculationResult,
  processPriceToAtomicAmount,
} from "@x402x/core_v2";
import type { Address } from "viem";
import type { Address as SolanaAddress } from "@solana/kit";

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
 * Creates a payment middleware for Hono with x402x settlement support
 *
 * This middleware is compatible with x402 official middleware API but adds
 * settlement extension support for executing on-chain hooks.
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
 * import { paymentMiddleware } from '@x402x/hono';
 *
 * const app = new Hono();
 *
 * app.use('/api/*', paymentMiddleware(
 *   '0xRecipient...', // Final recipient
 *   {
 *     price: '$0.01',
 *     network: 'base-sepolia',
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
  const { verify, settle } = useFacilitator(facilitator);
  const x402Version = 1;

  // Normalize routes to per-route config
  const isSimpleConfig = "price" in routes && "network" in routes;
  const normalizedRoutes = isSimpleConfig
    ? { "*": routes as X402xRouteConfig }
    : (routes as Record<string, X402xRouteConfig>);

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

  return async function middleware(c: Context, next: () => Promise<void>) {
    const method = c.req.method.toUpperCase();
    const matchingRoute = findMatchingRoute(routePatterns, c.req.path, method);

    if (!matchingRoute) {
      return next();
    }

    // Get the original config for this route
    const routeKey = Object.keys(normalizedRoutes).find((pattern) => {
      const [verb, path] = pattern.includes(" ") ? pattern.split(/\s+/) : ["*", pattern];
      if (verb !== "*" && verb.toUpperCase() !== method) return false;
      const regex = new RegExp(
        `^${(path || pattern)
          .replace(/[$()+.?^{|}]/g, "\\$&")
          .replace(/\*/g, ".*?")
          .replace(/\[([^\]]+)\]/g, "[^/]+")
          .replace(/\//g, "\\/")}$`,
        "i",
      );
      return regex.test(c.req.path);
    });

    const routeConfig = routeKey ? normalizedRoutes[routeKey] : normalizedRoutes["*"];
    if (!routeConfig) {
      return next();
    }

    const {
      price,
      network: networkConfig,
      hook,
      hookData,
      facilitatorFee,
      config = {},
    } = routeConfig;
    const { description, mimeType, maxTimeoutSeconds, resource, errorMessages } = config;

    // Try to decode payment first to check if client submitted paymentRequirements
    const payment = c.req.header("X-PAYMENT");
    let decodedPayment: PaymentPayload | undefined;
    let clientSubmittedRequirements: PaymentRequirements | undefined;

    if (payment) {
      try {
        decodedPayment = exact.evm.decodePayment(payment);
        decodedPayment.x402Version = x402Version;
        // Use client-submitted paymentRequirements if available
        // This ensures parameters like salt remain consistent throughout the flow
        clientSubmittedRequirements = decodedPayment.paymentRequirements;

        // Debug: log client-submitted requirements
        if (clientSubmittedRequirements) {
          console.log("[x402x Middleware] Client submitted paymentRequirements:", {
            path: c.req.path,
            network: clientSubmittedRequirements.network,
            extra: clientSubmittedRequirements.extra,
          });
        }
      } catch (error) {
        // Decoding failed, will handle below
        console.error("[x402x Middleware] Failed to decode payment:", error);
      }
    }

    let paymentRequirements: PaymentRequirements[];

    // If client submitted paymentRequirements, use them directly
    // This is critical for x402x: the salt must remain the same from 402 response to payment verification
    if (clientSubmittedRequirements) {
      paymentRequirements = [clientSubmittedRequirements];
    } else {
      // Build PaymentRequirements for each network (first request, no payment yet)
      paymentRequirements = [];

      // Support network array
      const networks = Array.isArray(networkConfig) ? networkConfig : [networkConfig];

      for (const network of networks) {
        // Only support EVM networks for now
        if (!SupportedEVMNetworks.includes(network)) {
          continue;
        }

        const atomicAmountForAsset = processPriceToAtomicAmount(price, network);
        if ("error" in atomicAmountForAsset) {
          throw new Error(atomicAmountForAsset.error);
        }
        const { maxAmountRequired: baseAmount, asset } = atomicAmountForAsset;

        const resourceUrl: Resource = resource || (c.req.url as Resource);
        const x402xConfig = getNetworkConfig(network);

        // Resolve hook and hookData (support function or string)
        const resolvedHook =
          typeof hook === "function" ? hook(network) : hook || TransferHook.getAddress(network);

        const resolvedHookData =
          typeof hookData === "function" ? hookData(network) : hookData || TransferHook.encode();

        // Resolve facilitatorFee (support function or value)
        // If not configured or "auto", query from facilitator dynamically
        let resolvedFacilitatorFeeRaw =
          typeof facilitatorFee === "function" ? facilitatorFee(network) : facilitatorFee;

        let resolvedFacilitatorFee: string;
        let businessAmount: string;
        let maxAmountRequired: string;

        // Check if we should dynamically query fee
        if (resolvedFacilitatorFeeRaw === undefined || resolvedFacilitatorFeeRaw === "auto") {
          // Dynamic fee calculation
          if (!facilitator?.url) {
            throw new Error(
              `Facilitator URL required for dynamic fee calculation. ` +
                `Please provide facilitator config in paymentMiddleware() or set static facilitatorFee.`,
            );
          }

          try {
            const feeResult = await calculateFacilitatorFee(
              facilitator.url,
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

            console.log("[x402x Middleware] Dynamic fee calculated:", {
              network,
              hook: resolvedHook,
              businessAmount,
              facilitatorFee: resolvedFacilitatorFee,
              totalAmount: maxAmountRequired,
              feeUSD: feeResult.facilitatorFeeUSD,
            });
          } catch (error) {
            console.error("[x402x Middleware] Failed to calculate dynamic fee:", error);
            throw new Error(
              `Failed to query facilitator fee: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
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
          resource: resourceUrl,
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
          payTo, // Final recipient
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
    }

    // Check for X-PAYMENT header (payment might be undefined if decoding failed earlier)
    if (!payment || !decodedPayment) {
      // No payment, return 402
      return c.json(
        {
          error: errorMessages?.paymentRequired || "X-PAYMENT header is required",
          accepts: paymentRequirements,
          x402Version,
        },
        402,
      );
    }

    // Find matching payment requirement
    const selectedPaymentRequirements = findMatchingPaymentRequirements(
      paymentRequirements,
      decodedPayment,
    );

    if (!selectedPaymentRequirements) {
      return c.json(
        {
          error:
            errorMessages?.noMatchingRequirements || "Unable to find matching payment requirements",
          accepts: toJsonSafe(paymentRequirements),
          x402Version,
        },
        402,
      );
    }

    // Verify payment
    const verification = await verify(decodedPayment, selectedPaymentRequirements);

    if (!verification.isValid) {
      return c.json(
        {
          error: errorMessages?.verificationFailed || verification.invalidReason,
          accepts: paymentRequirements,
          payer: verification.payer,
          x402Version,
        },
        402,
      );
    }

    // Set x402 context for handler access (x402x extension)
    // Note: verification.payer is guaranteed to exist when verification.isValid is true
    if (!verification.payer) {
      throw new Error("Payer address is missing from verification result");
    }

    const x402Context: X402Context = {
      payer: verification.payer as Address | SolanaAddress,
      amount: selectedPaymentRequirements.maxAmountRequired,
      network: selectedPaymentRequirements.network,
      payment: decodedPayment,
      requirements: selectedPaymentRequirements,
      settlement: selectedPaymentRequirements.extra
        ? {
            router: selectedPaymentRequirements.payTo as Address,
            hook: (selectedPaymentRequirements.extra as any).hook as Address,
            hookData: (selectedPaymentRequirements.extra as any).hookData as string,
            facilitatorFee: (selectedPaymentRequirements.extra as any).facilitatorFee as string,
          }
        : undefined,
    };
    c.set("x402", x402Context);

    // Proceed with request (execute business logic)
    await next();

    let res = c.res;

    // If the response from the protected route is >= 400, do not settle payment
    if (res.status >= 400) {
      return;
    }

    c.res = undefined;

    // Settle payment before sending the response
    try {
      const settlement = await settle(decodedPayment, selectedPaymentRequirements);
      if (settlement.success) {
        const responseHeader = settleResponseHeader(settlement);
        res.headers.set("X-PAYMENT-RESPONSE", responseHeader);
      } else {
        throw new Error(settlement.errorReason);
      }
    } catch (error) {
      res = c.json(
        {
          error:
            errorMessages?.settlementFailed ||
            (error instanceof Error ? error.message : "Failed to settle payment"),
          accepts: paymentRequirements,
          x402Version,
        },
        402,
      );
    }

    c.res = res;
  };
}

// Re-export types for convenience
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
