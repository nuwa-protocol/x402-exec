/**
 * Express middleware for x402x
 *
 * Provides payment middleware for Express-based resource servers with settlement support.
 * Compatible with x402 official middleware API with x402x extensions.
 */

import type { Request, Response, NextFunction } from "express";
import { exact } from "x402/schemes";
import {
  computeRoutePatterns,
  findMatchingPaymentRequirements,
  findMatchingRoute,
  processPriceToAtomicAmount,
  toJsonSafe,
} from "x402/shared";
import {
  FacilitatorConfig,
  PaymentPayload,
  PaymentRequirements,
  Resource,
  settleResponseHeader,
  SupportedEVMNetworks,
  type Money,
  type Network,
} from "x402/types";
import { useFacilitator } from "x402/verify";
import {
  addSettlementExtra,
  getNetworkConfig,
  TransferHook,
  calculateFacilitatorFee,
  type FeeCalculationResult,
} from "@x402x/core";
import type { Address } from "viem";
import type { Address as SolanaAddress } from "@solana/kit";

/**
 * Payment context information available to handlers via req.x402
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
 * Extended Express Request with x402 context
 */
export interface X402Request extends Request {
  x402?: X402Context;
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
 * Routes configuration - can be a single config or a map of routes
 */
export type X402xRoutesConfig = X402xRouteConfig | Record<string, X402xRouteConfig>;

/**
 * Create Express middleware for x402x settlement
 *
 * This middleware provides full x402 payment flow with x402x settlement support:
 * 1. Returns 402 with PaymentRequirements when no payment is provided
 * 2. Verifies payment signature via facilitator
 * 3. Executes route handler (business logic)
 * 4. Settles payment via facilitator
 * 5. Returns X-PAYMENT-RESPONSE header
 *
 * @param payTo - Final recipient address for payments
 * @param routes - Route configuration(s) for payment requirements
 * @param facilitator - Optional facilitator configuration
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { paymentMiddleware } from '@x402x/express';
 *
 * const app = express();
 *
 * // Single route configuration
 * app.post('/api/payment',
 *   paymentMiddleware(
 *     "0xYourAddress",
 *     {
 *       price: "$0.10",
 *       network: "base-sepolia",
 *       facilitatorFee: "$0.01",
 *       config: {
 *         description: "Premium content access",
 *       }
 *     },
 *     facilitatorConfig
 *   ),
 *   (req, res) => {
 *     // Access payment context (x402x extension)
 *     const { payer, amount, network } = req.x402!;
 *     console.log(`Payment from ${payer}: ${amount} on ${network}`);
 *
 *     res.json({ message: "Success" });
 *   }
 * );
 *
 * // Multiple routes configuration
 * app.use(paymentMiddleware(
 *   "0xYourAddress",
 *   {
 *     "/api/basic": {
 *       price: "$0.01",
 *       network: "base-sepolia",
 *     },
 *     "/api/premium": {
 *       price: "$1.00",
 *       network: ["base-sepolia", "base"],
 *     }
 *   },
 *   facilitatorConfig
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

  return async function middleware(req: Request, res: Response, next: NextFunction) {
    const method = req.method.toUpperCase();
    const matchingRoute = findMatchingRoute(routePatterns, req.path, method);

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
      return regex.test(req.path);
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
    const { description, mimeType, maxTimeoutSeconds, resource, errorMessages = {} } = config;

    // Try to decode payment first to check if client submitted paymentRequirements
    const payment = req.headers["x-payment"] as string | undefined;
    let decodedPayment: PaymentPayload | undefined;
    let clientSubmittedRequirements: PaymentRequirements | undefined;

    if (payment) {
      try {
        decodedPayment = exact.evm.decodePayment(payment);
        decodedPayment.x402Version = x402Version;
        // Use client-submitted paymentRequirements if available
        clientSubmittedRequirements = decodedPayment.paymentRequirements;

        if (clientSubmittedRequirements) {
          console.log("[x402x Express] Client submitted paymentRequirements:", {
            path: req.path,
            network: clientSubmittedRequirements.network,
            extra: clientSubmittedRequirements.extra,
          });
        }
      } catch (error) {
        console.error("[x402x Express] Failed to decode payment:", error);
      }
    }

    let paymentRequirements: PaymentRequirements[];

    // If client submitted paymentRequirements, use them directly
    if (clientSubmittedRequirements) {
      paymentRequirements = [clientSubmittedRequirements];
    } else {
      // Build PaymentRequirements for each network (first request, no payment yet)
      paymentRequirements = [];

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

        const resourceUrl: Resource = resource || (req.originalUrl as Resource);
        const x402xConfig = getNetworkConfig(network);

        // Resolve hook and hookData
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
            maxAmountRequired = (BigInt(businessAmount) + BigInt(resolvedFacilitatorFee)).toString();

            console.log("[x402x Express] Dynamic fee calculated:", {
              network,
              hook: resolvedHook,
              businessAmount,
              facilitatorFee: resolvedFacilitatorFee,
              totalAmount: maxAmountRequired,
              feeUSD: feeResult.facilitatorFeeUSD,
            });
          } catch (error) {
            console.error("[x402x Express] Failed to calculate dynamic fee:", error);
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
          maxAmountRequired = baseAmount;
        }

        // Build base PaymentRequirements
        const baseRequirements: PaymentRequirements = {
          scheme: "exact",
          network,
          maxAmountRequired,
          resource: resourceUrl,
          description: description || `Payment of ${maxAmountRequired} on ${network}`,
          mimeType: mimeType || "application/json",
          payTo: x402xConfig.settlementRouter as Address,
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
          payTo,
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

    // Check for X-PAYMENT header
    if (!payment || !decodedPayment) {
      // No payment, return 402
      return res.status(402).json({
        error: errorMessages?.paymentRequired || "X-PAYMENT header is required",
        accepts: paymentRequirements,
        x402Version,
      });
    }

    // Decode payment (if not already decoded)
    if (!decodedPayment) {
      try {
        decodedPayment = exact.evm.decodePayment(payment!);
        decodedPayment.x402Version = x402Version;
      } catch (error) {
        return res.status(402).json({
          error:
            errorMessages?.invalidPayment ||
            (error instanceof Error ? error.message : "Invalid or malformed payment header"),
          accepts: paymentRequirements,
          x402Version,
        });
      }
    }

    // Find matching payment requirement
    const selectedPaymentRequirements = findMatchingPaymentRequirements(
      paymentRequirements,
      decodedPayment,
    );

    if (!selectedPaymentRequirements) {
      return res.status(402).json({
        error:
          errorMessages?.noMatchingRequirements || "Unable to find matching payment requirements",
        accepts: toJsonSafe(paymentRequirements),
        x402Version,
      });
    }

    // Verify payment
    const verification = await verify(decodedPayment, selectedPaymentRequirements);

    if (!verification.isValid) {
      return res.status(402).json({
        error: errorMessages?.verificationFailed || verification.invalidReason,
        accepts: paymentRequirements,
        payer: verification.payer,
        x402Version,
      });
    }

    // Set x402 context for handler access (x402x extension)
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

    // Attach to request
    (req as X402Request).x402 = x402Context;

    // Intercept res.end to settle after handler execution
    type EndArgs =
      | [cb?: (() => void) | undefined]
      | [chunk: any, cb?: (() => void) | undefined]
      | [chunk: any, encoding: BufferEncoding, cb?: (() => void) | undefined];

    const originalEnd = res.end.bind(res);
    let endArgs: EndArgs | null = null;

    res.end = function (...args: EndArgs) {
      endArgs = args;
      return res;
    } as typeof res.end;

    // Proceed with request (execute business logic)
    try {
      await new Promise<void>((resolve, reject) => {
        next((err?: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      res.end = originalEnd;
      throw error;
    }

    // If the response from the protected route is >= 400, do not settle payment
    if (res.statusCode >= 400) {
      res.end = originalEnd;
      if (endArgs) {
        originalEnd(...(endArgs as Parameters<typeof res.end>));
      }
      return;
    }

    // Settle payment
    try {
      const settlement = await settle(decodedPayment, selectedPaymentRequirements);
      if (settlement.success) {
        const responseHeader = settleResponseHeader(settlement);
        res.setHeader("X-PAYMENT-RESPONSE", responseHeader);
      } else {
        throw new Error(settlement.errorReason);
      }
    } catch (error) {
      res.end = originalEnd;
      return res.status(402).json({
        error:
          errorMessages?.settlementFailed ||
          (error instanceof Error ? error.message : "Failed to settle payment"),
        accepts: paymentRequirements,
        x402Version,
      });
    } finally {
      res.end = originalEnd;
      if (endArgs) {
        originalEnd(...(endArgs as Parameters<typeof res.end>));
      }
    }
  };
}

// Re-export types from x402 for compatibility
export type { Money, Network, FacilitatorConfig, PaymentRequirements, Resource } from "x402/types";

export type { Address } from "viem";
export type { Address as SolanaAddress } from "@solana/kit";
