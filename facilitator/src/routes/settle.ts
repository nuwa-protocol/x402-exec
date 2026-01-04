/**
 * Settle Routes
 *
 * Provides settlement endpoints for x402 payments:
 * - GET /settle: Endpoint information
 * - POST /settle: Settle payment (v2-only)
 *
 * v1 is deprecated - only x402Version=2 is supported.
 * Routes requests to v2 implementation using @x402x/facilitator-sdk with SettlementRouter.
 */

import { Router, Request, Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { type PaymentRequirements, type PaymentPayload } from "x402/types";
import { validateBasicStructure, validateX402Version } from "./validation.js";
import { getLogger, recordMetric, recordHistogram } from "../telemetry.js";
import type { PoolManager } from "../pool-manager.js";
import type { RequestHandler } from "express";
import type { BalanceChecker } from "../balance-check.js";
import type { GasCostConfig } from "../gas-cost.js";
import type { DynamicGasPriceConfig } from "../dynamic-gas-price.js";
import type { GasEstimationConfig } from "../gas-estimation/index.js";
import { DuplicatePayerError, QueueOverloadError } from "../errors.js";
import {
  createVersionDispatcher,
  type SettleRequest,
  type VersionDispatcherDependencies,
} from "../version-dispatcher.js";

const logger = getLogger();

/**
 * Dependencies required by settle routes
 */
export interface SettleRouteDependencies {
  poolManager: PoolManager;
  allowedSettlementRouters: Record<string, string[]>;
  gasCost?: GasCostConfig; // Gas cost config for fee validation and dynamic gas limit
  dynamicGasPrice?: DynamicGasPriceConfig; // Dynamic gas price config for gas limit calculation
  balanceChecker?: BalanceChecker;
  gasEstimation?: GasEstimationConfig; // Gas estimation config for pre-validation
  /** RPC URLs per network (network name -> RPC URL) */
  rpcUrls?: Record<string, string>;
  /** Enable v2 support (requires FACILITATOR_ENABLE_V2=true) */
  enableV2?: boolean;
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
 * @param dispatcher - Shared version dispatcher (optional, will create new if not provided)
 * @returns Express Router with settle endpoints
 */
export function createSettleRoutes(
  deps: SettleRouteDependencies,
  rateLimiter: RateLimitRequestHandler,
  hookValidation?: RequestHandler,
  feeValidation?: RequestHandler,
  dispatcher?: ReturnType<typeof createVersionDispatcher>,
): Router {
  const router = Router();

  // Use provided dispatcher or create new one
  const versionDispatcher =
    dispatcher ||
    createVersionDispatcher(
      {
        poolManager: deps.poolManager,
        balanceChecker: deps.balanceChecker,
        allowedSettlementRouters: deps.allowedSettlementRouters,
      },
      {
        enableV2: deps.enableV2,
        allowedRouters: deps.allowedRouters,
        rpcUrls: deps.rpcUrls,
      },
    );

  /**
   * GET /settle - Returns info about the settle endpoint
   */
  router.get("/settle", (req: Request, res: Response) => {
    res.json({
      endpoint: "/settle",
      description: "POST to settle x402 payments (v2-only)",
      supportedVersions: [2],
      versionDetection: "x402Version field is required and must be 2",
      supportedModes: ["v2_router"],
      deprecationNotice: "v1 is deprecated - please use x402Version=2",
      body: {
        paymentPayload: "PaymentPayload (with x402Version=2)",
        paymentRequirements: "PaymentRequirements",
        x402Version: "number (required, must be 2)",
      },
    });
  });

  /**
   * POST /settle - Settle x402 payment (v2-only)
   */
  const middlewares: Array<RequestHandler | RateLimitRequestHandler> = [rateLimiter];
  if (hookValidation) middlewares.push(hookValidation);
  if (feeValidation) middlewares.push(feeValidation);

  router.post("/settle", ...(middlewares as any), async (req: Request, res: Response) => {
    try {
      const body: SettleRequest = req.body;

      // Basic structure validation - let VersionDispatcher handle detailed validation
      const paymentRequirements = validateBasicStructure(
        body.paymentRequirements,
        "paymentRequirements",
      ) as PaymentRequirements;
      const paymentPayload = validateBasicStructure(
        body.paymentPayload,
        "paymentPayload",
      ) as PaymentPayload;

      // Validate x402Version if provided
      validateX402Version(body.x402Version);

      // Route to appropriate implementation based on version
      const result = await versionDispatcher.settle({
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
      if (
        error instanceof Error &&
        (error.name === "ZodError" || error.name === "ValidationError")
      ) {
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
