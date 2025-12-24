/**
 * Settle Routes
 *
 * Provides settlement endpoints for x402 payments:
 * - GET /settle: Endpoint information
 * - POST /settle: Settle payment (supports both v1 and v2)
 *
 * Routes requests to appropriate implementation based on x402Version:
 * - v1: Uses legacy x402/facilitator implementation with SettlementRouter support
 * - v2: Uses @x402x/facilitator_v2 with SettlementRouter
 */

import { Router, Request, Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import {
  type PaymentRequirements,
  type PaymentPayload,
  type X402Config,
} from "x402/types";
import { validateBasicStructure, validateX402Version } from "./validation.js";
import { getLogger, recordMetric, recordHistogram } from "../telemetry.js";
import type { PoolManager } from "../pool-manager.js";
import type { RequestHandler } from "express";
import type { BalanceChecker } from "../balance-check.js";
import type { GasCostConfig } from "../gas-cost.js";
import type { DynamicGasPriceConfig } from "../dynamic-gas-price.js";
import type { GasEstimationConfig } from "../gas-estimation/index.js";
import { DuplicatePayerError, QueueOverloadError } from "../errors.js";
import { createVersionDispatcher, type SettleRequest, type VersionDispatcherDependencies } from "../version-dispatcher.js";

const logger = getLogger();

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
  gasEstimation?: GasEstimationConfig; // Gas estimation config for pre-validation
  /** RPC URLs per network (network name -> RPC URL) */
  rpcUrls?: Record<string, string>;
  /** Enable v2 support (requires FACILITATOR_ENABLE_V2=true) */
  enableV2?: boolean;
  /** Facilitator signer address for v2 (optional, will be derived from privateKey if not provided) */
  v2Signer?: string;
  /** Private key for v2 local signing (reuses EVM_PRIVATE_KEY from v1) */
  v2PrivateKey?: string;
  /** Allowed routers per network for v2 */
  allowedRouters?: Record<string, string[]>;
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

  // Create version dispatcher for routing between v1 and v2
  const dispatcher = createVersionDispatcher(
    {
      poolManager: deps.poolManager,
      x402Config: deps.x402Config,
      balanceChecker: deps.balanceChecker,
      allowedSettlementRouters: deps.allowedSettlementRouters,
    },
    {
      enableV2: deps.enableV2,
      signer: deps.v2Signer,
      privateKey: deps.v2PrivateKey,
      allowedRouters: deps.allowedRouters,
      rpcUrls: deps.rpcUrls,
    }
  );

  /**
   * GET /settle - Returns info about the settle endpoint
   */
  router.get("/settle", (req: Request, res: Response) => {
    res.json({
      endpoint: "/settle",
      description: "POST to settle x402 payments (supports both v1 and v2)",
      supportedVersions: deps.enableV2 ? [1, 2] : [1],
      versionDetection: "Determined by x402Version field (defaults to 1)",
      supportedModes: deps.enableV2
        ? ["v1_standard", "v1_settlementRouter", "v2_router"]
        : ["v1_standard", "v1_settlementRouter"],
      body: {
        paymentPayload: "PaymentPayload (with optional x402Version)",
        paymentRequirements: "PaymentRequirements",
        x402Version: "number (optional, defaults to 1)",
      },
    });
  });

  /**
   * POST /settle - Settle x402 payment (supports both v1 and v2)
   */
  const middlewares: Array<RequestHandler | RateLimitRequestHandler> = [rateLimiter];
  if (hookValidation) middlewares.push(hookValidation);
  if (feeValidation) middlewares.push(feeValidation);

  router.post("/settle", ...(middlewares as any), async (req: Request, res: Response) => {
    try {
      const body: SettleRequest = req.body;

      // Basic structure validation - let VersionDispatcher handle detailed validation
      const paymentRequirements = validateBasicStructure(body.paymentRequirements, 'paymentRequirements') as PaymentRequirements;
      const paymentPayload = validateBasicStructure(body.paymentPayload, 'paymentPayload') as PaymentPayload;

      // Validate x402Version if provided
      validateX402Version(body.x402Version);

      // Route to appropriate implementation based on version
      const result = await dispatcher.settle({
        paymentPayload,
        paymentRequirements,
        x402Version: body.x402Version,
      });

      res.json(result);
    } catch (error) {
      logger.error({ error }, "Settle error");

      // Check for duplicate payer errors first
      if (error instanceof DuplicatePayerError) {
        res.status(429).json({
          error: "Duplicate payer in queue",
          message: error.message,
          retryAfter: 10, // Suggest retry after 10 seconds
        });
        return;
      }

      // Check for queue overload errors
      if (error instanceof QueueOverloadError) {
        res.status(503).json({
          error: "Service temporarily overloaded",
          message: error.message,
          retryAfter: 60, // Suggest retry after 60 seconds
        });
        return;
      }

      // Distinguish between validation errors and other errors
      if (error instanceof Error && (error.name === "ZodError" || error.name === "ValidationError")) {
        // Input validation error - safe to return details
        res.status(400).json({
          error: "Invalid request payload",
          message: "Request validation failed. Please check your input format.",
        });
      } else if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes("version") || message.includes("v2")) {
          res.status(400).json({
            error: "Version not supported",
            message: error.message,
          });
        } else if (message.includes("network")) {
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
