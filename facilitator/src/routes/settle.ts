/**
 * Settle Routes
 *
 * Provides settlement endpoints for x402 payments:
 * - GET /settle: Endpoint information
 * - POST /settle: Settle payment (auto-detects standard or SettlementRouter mode)
 */

import { Router, Request, Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { settle } from "x402/facilitator";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  SupportedEVMNetworks,
  type Signer,
  type X402Config,
} from "x402/types";
import { isSettlementMode, settleWithRouter } from "../settlement.js";
import { getLogger, traced, recordMetric, recordHistogram } from "../telemetry.js";
import type { PoolManager } from "../pool-manager.js";
import { isStandardX402Allowed } from "../config.js";
import type { RequestHandler } from "express";
import type { BalanceChecker } from "../balance-check.js";
import type { GasCostConfig } from "../gas-cost.js";
import type { DynamicGasPriceConfig } from "../dynamic-gas-price.js";

const logger = getLogger();

/**
 * Settle request body
 */
type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

/**
 * Dependencies required by settle routes
 */
export interface SettleRouteDependencies {
  poolManager: PoolManager;
  allowedSettlementRouters: Record<string, string[]>;
  x402Config?: X402Config;
  gasCost?: GasCostConfig; // Gas cost config for fee validation and dynamic gas limit
  dynamicGasPrice?: DynamicGasPriceConfig; // Dynamic gas price config for gas limit calculation
  balanceChecker?: BalanceChecker;
}

/**
 * Create settle routes
 *
 * @param deps - Dependencies for settle routes
 * @param rateLimiter - Rate limiting middleware
 * @param hookValidation - Hook whitelist validation middleware
 * @param feeValidation - Fee validation middleware
 * @returns Express Router with settle endpoints
 */
export function createSettleRoutes(
  deps: SettleRouteDependencies,
  rateLimiter: RateLimitRequestHandler,
  hookValidation?: RequestHandler,
  feeValidation?: RequestHandler,
): Router {
  const router = Router();

  /**
   * GET /settle - Returns info about the settle endpoint
   */
  router.get("/settle", (req: Request, res: Response) => {
    res.json({
      endpoint: "/settle",
      description: "POST to settle x402 payments",
      supportedModes: ["standard", "settlementRouter"],
      body: {
        paymentPayload: "PaymentPayload",
        paymentRequirements: "PaymentRequirements (with optional extra.settlementRouter)",
      },
    });
  });

  /**
   * POST /settle - Settle x402 payment using account pool (with rate limiting)
   *
   * This endpoint supports two settlement modes:
   * 1. Standard mode: Direct token transfer using ERC-3009
   * 2. Settlement Router mode: Token transfer + Hook execution via SettlementRouter
   *
   * The mode is automatically detected based on the presence of extra.settlementRouter
   */
  const middlewares: Array<RequestHandler | RateLimitRequestHandler> = [rateLimiter];
  if (hookValidation) middlewares.push(hookValidation);
  if (feeValidation) middlewares.push(feeValidation);

  router.post("/settle", ...(middlewares as any), async (req: Request, res: Response) => {
    try {
      const body: SettleRequest = req.body;
      const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
      const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

      // Get the appropriate account pool
      let accountPool = deps.poolManager.getPool(paymentRequirements.network);

      if (!accountPool) {
        throw new Error(`No account pool available for network: ${paymentRequirements.network}`);
      }

      const startTime = Date.now();

      // Execute settlement in the account pool's queue
      // This ensures serial execution per account (no nonce conflicts)
      const result = await accountPool.execute(async (signer: Signer) => {
        // Check if this is a Settlement Router payment
        if (isSettlementMode(paymentRequirements)) {
          logger.info(
            {
              router: paymentRequirements.extra?.settlementRouter,
              hook: paymentRequirements.extra?.hook,
              facilitatorFee: paymentRequirements.extra?.facilitatorFee,
              salt: paymentRequirements.extra?.salt,
            },
            "Settlement Router mode detected",
          );

          // Ensure this is an EVM network (Settlement Router is EVM-only)
          if (!SupportedEVMNetworks.includes(paymentRequirements.network)) {
            throw new Error("Settlement Router mode is only supported on EVM networks");
          }

          try {
            // Settle using SettlementRouter with whitelist validation
            const response = await traced(
              "settle.settlementRouter",
              async () =>
                settleWithRouter(
                  signer,
                  paymentPayload,
                  paymentRequirements,
                  deps.allowedSettlementRouters,
                  deps.gasCost, // Pass gas cost config for dynamic gas limit
                  deps.dynamicGasPrice, // Pass dynamic gas price config
                  deps.gasCost?.nativeTokenPrice, // Pass native token prices for gas metrics
                  deps.balanceChecker, // Pass balance checker for defensive checks
                  deps.x402Config, // Pass x402 config for verification
                ),
              {
                network: paymentRequirements.network,
                router: paymentRequirements.extra?.settlementRouter || "",
              },
            );

            const duration = Date.now() - startTime;

            // Record metrics
            recordMetric("facilitator.settle.total", 1, {
              network: paymentRequirements.network,
              mode: "settlementRouter",
              success: String(response.success),
            });
            recordHistogram("facilitator.settle.duration_ms", duration, {
              network: paymentRequirements.network,
              mode: "settlementRouter",
            });

            // Record gas metrics if available
            if (response.success && response.gasMetrics) {
              const metrics = response.gasMetrics;

              recordHistogram("facilitator.settlement.gas_used", parseInt(metrics.gasUsed), {
                network: paymentRequirements.network,
                hook: metrics.hook,
              });

              recordHistogram(
                "facilitator.settlement.gas_cost_usd",
                parseFloat(metrics.actualGasCostUSD),
                {
                  network: paymentRequirements.network,
                  hook: metrics.hook,
                },
              );

              recordHistogram(
                "facilitator.settlement.facilitator_fee_usd",
                parseFloat(metrics.facilitatorFeeUSD),
                {
                  network: paymentRequirements.network,
                  hook: metrics.hook,
                },
              );

              recordHistogram("facilitator.settlement.profit_usd", parseFloat(metrics.profitUSD), {
                network: paymentRequirements.network,
                hook: metrics.hook,
              });

              recordMetric("facilitator.settlement.profitable", metrics.profitable ? 1 : 0, {
                network: paymentRequirements.network,
                hook: metrics.hook,
              });
            }

            logger.info(
              {
                transaction: response.transaction,
                success: response.success,
                payer: response.payer,
                duration_ms: duration,
              },
              "SettlementRouter settlement successful",
            );

            // Return standard SettleResponse without gas metrics (internal use only)
            return {
              success: response.success,
              transaction: response.transaction,
              network: response.network,
              payer: response.payer,
              errorReason: response.errorReason,
            };
          } catch (error) {
            const duration = Date.now() - startTime;

            logger.error({ error, duration_ms: duration }, "Settlement failed");
            recordMetric("facilitator.settle.errors", 1, {
              network: paymentRequirements.network,
              mode: "settlementRouter",
              error_type: error instanceof Error ? error.name : "unknown",
            });
            throw error;
          }
        } else {
          logger.info(
            {
              network: paymentRequirements.network,
              asset: paymentRequirements.asset,
              maxAmountRequired: paymentRequirements.maxAmountRequired,
            },
            "Standard settlement mode",
          );

          // Check if standard x402 is allowed on this network
          if (!isStandardX402Allowed(paymentRequirements.network)) {
            throw new Error(
              "Standard x402 settlement is not supported on mainnet. " +
                "Please use SettlementRouter (x402x) mode with facilitatorFee for security.",
            );
          }

          try {
            // Settle using standard x402 flow
            const response = await traced(
              "settle.standard",
              async () => settle(signer, paymentPayload, paymentRequirements, deps.x402Config),
              {
                network: paymentRequirements.network,
              },
            );

            const duration = Date.now() - startTime;

            // Record metrics
            recordMetric("facilitator.settle.total", 1, {
              network: paymentRequirements.network,
              mode: "standard",
              success: String(response.success),
            });
            recordHistogram("facilitator.settle.duration_ms", duration, {
              network: paymentRequirements.network,
              mode: "standard",
            });

            logger.info(
              {
                transaction: response.transaction,
                success: response.success,
                payer: response.payer,
                duration_ms: duration,
              },
              "Standard settlement successful",
            );

            return response;
          } catch (error) {
            const duration = Date.now() - startTime;

            logger.error({ error, duration_ms: duration }, "Standard settlement failed");
            recordMetric("facilitator.settle.errors", 1, {
              network: paymentRequirements.network,
              mode: "standard",
              error_type: error instanceof Error ? error.name : "unknown",
            });
            throw error;
          }
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error }, "Settle error");

      // Distinguish between validation errors and other errors
      if (error instanceof Error && error.name === "ZodError") {
        // Input validation error - safe to return details
        res.status(400).json({
          error: "Invalid request payload",
          message: "Request validation failed. Please check your input format.",
        });
      } else if (error instanceof Error) {
        // Other errors - sanitize error messages
        const message = error.message.toLowerCase();
        if (message.includes("network")) {
          res.status(400).json({
            error: "Invalid network",
            message: "The specified network is not supported.",
          });
        } else if (message.includes("account pool") || message.includes("no account")) {
          res.status(503).json({
            error: "Service unavailable",
            message: "Settlement service is temporarily unavailable. Please try again later.",
          });
        } else if (message.includes("settlement router") || message.includes("whitelist")) {
          res.status(400).json({
            error: "Invalid settlement router",
            message: "The specified settlement router is not authorized.",
          });
        } else {
          res.status(500).json({
            error: "Settlement failed",
            message: "Unable to complete settlement. Please try again later.",
          });
        }
      } else {
        res.status(500).json({
          error: "Internal error",
          message: "An unexpected error occurred. Please try again later.",
        });
      }
    }
  });

  return router;
}
