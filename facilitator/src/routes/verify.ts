/**
 * Verify Routes
 *
 * Provides verification endpoints for x402 payment payloads:
 * - GET /verify: Endpoint information
 * - POST /verify: Verify payment payload (v2-only)
 *
 * v1 is deprecated - only x402Version=2 is supported.
 * Routes requests to v2 implementation using @x402x/facilitator-sdk with SettlementRouter.
 */

import { Router, Request, Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { type PaymentRequirements, type PaymentPayload } from "@x402/core/types";
import { validateBasicStructure, validateX402Version } from "./validation.js";
import { getLogger } from "../telemetry.js";
import type { PoolManager } from "../pool-manager.js";
import type { RequestHandler } from "express";
import type { BalanceChecker } from "../balance-check.js";
import type { X402Config } from "../config.js";
import {
  createRouterSettlementService,
  type VerifyRequest,
  type RouterSettlementServiceDependencies,
} from "../router-settlement-service.js";

const logger = getLogger();

/**
 * Dependencies required by verify routes
 */
export interface VerifyRouteDependencies {
  poolManager: PoolManager;
  x402Config?: X402Config;
  balanceChecker?: BalanceChecker;
  /** RPC URLs per network (network name -> RPC URL) */
  rpcUrls?: Record<string, string>;
  /** Enable v2 support (requires FACILITATOR_ENABLE_V2=true) */
  enableV2?: boolean;
  /** Allowed routers per network for v2 */
  allowedRouters?: Record<string, string[]>;
}

/**
 * Create verify routes
 *
 * @param deps - Dependencies for verify routes
 * @param rateLimiter - Rate limiting middleware
 * @param hookValidation - Hook whitelist validation middleware
 * @param feeValidation - Fee validation middleware
 * @param service - Shared Router Settlement Service (optional, will create new if not provided)
 * @returns Express Router with verify endpoints
 */
export function createVerifyRoutes(
  deps: VerifyRouteDependencies,
  rateLimiter: RateLimitRequestHandler,
  hookValidation?: RequestHandler,
  feeValidation?: RequestHandler,
  service?: ReturnType<typeof createRouterSettlementService>,
): Router {
  const router = Router();

  // Use provided service or create new one
  const routerSettlementService =
    service ||
    createRouterSettlementService(
      {
        poolManager: deps.poolManager,
        x402Config: deps.x402Config,
        balanceChecker: deps.balanceChecker,
      },
      {
        enableV2: deps.enableV2,
        allowedRouters: deps.allowedRouters,
        rpcUrls: deps.rpcUrls,
      },
    );

  /**
   * GET /verify - Returns info about the verify endpoint
   */
  router.get("/verify", (req: Request, res: Response) => {
    res.json({
      endpoint: "/verify",
      description: "POST to verify x402 payments (v2-only)",
      supportedVersions: [2],
      versionDetection: "x402Version field is required and must be 2",
      deprecationNotice: "v1 is deprecated - please use x402Version=2",
      body: {
        paymentPayload: "PaymentPayload (with x402Version=2)",
        paymentRequirements: "PaymentRequirements",
        x402Version: "number (required, must be 2)",
      },
    });
  });

  /**
   * POST /verify - Verify x402 payment payload (v2-only)
   */
  const middlewares: Array<RequestHandler | RateLimitRequestHandler> = [rateLimiter];
  if (hookValidation) middlewares.push(hookValidation);
  if (feeValidation) middlewares.push(feeValidation);

  router.post("/verify", ...(middlewares as any), async (req: Request, res: Response) => {
    try {
      const body: VerifyRequest = req.body;

      // Basic structure validation - let RouterSettlementService handle detailed validation
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
      const result = await routerSettlementService.verify({
        paymentPayload,
        paymentRequirements,
        x402Version: body.x402Version,
      });

      res.json(result);
    } catch (error) {
      logger.error({ error }, "Verify error");

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
        } else if (message.includes("network") || message.includes("account")) {
          res.status(400).json({
            error: "Invalid request",
            message: "The specified network or configuration is not supported.",
          });
        } else {
          res.status(400).json({
            error: "Verification failed",
            message: "Unable to verify payment. Please try again later.",
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
