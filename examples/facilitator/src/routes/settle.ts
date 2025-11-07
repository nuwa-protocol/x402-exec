/**
 * Settle Routes
 *
 * Provides settlement endpoints for x402 payments:
 * - GET /settle: Endpoint information
 * - POST /settle: Settle payment (auto-detects standard or SettlementRouter mode)
 */

import { Router, Request, Response } from "express";
import { settle } from "x402/facilitator";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
  type Signer,
  type X402Config,
} from "x402/types";
import { isSettlementMode, settleWithRouter } from "../settlement.js";
import { getLogger, traced, recordMetric, recordHistogram } from "../telemetry.js";
import type { PoolManager } from "../pool-manager.js";

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
}

/**
 * Create settle routes
 *
 * @param deps - Dependencies for settle routes
 * @returns Express Router with settle endpoints
 */
export function createSettleRoutes(deps: SettleRouteDependencies): Router {
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
   * POST /settle - Settle x402 payment using account pool
   *
   * This endpoint supports two settlement modes:
   * 1. Standard mode: Direct token transfer using ERC-3009
   * 2. Settlement Router mode: Token transfer + Hook execution via SettlementRouter
   *
   * The mode is automatically detected based on the presence of extra.settlementRouter
   */
  router.post("/settle", async (req: Request, res: Response) => {
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

            logger.info(
              {
                transaction: response.transaction,
                success: response.success,
                payer: response.payer,
                duration_ms: duration,
              },
              "SettlementRouter settlement successful",
            );

            return response;
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
      res.status(400).json({
        error: `Settlement failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error instanceof Error ? error.stack : undefined,
      });
    }
  });

  return router;
}
