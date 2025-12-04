/**
 * Verify Routes
 *
 * Provides verification endpoints for x402 payment payloads:
 * - GET /verify: Endpoint information
 * - POST /verify: Verify payment payload
 */

import { Router, Request, Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { verify } from "x402/facilitator";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  SupportedEVMNetworks,
  type ConnectedClient,
  type X402Config,
  evm,
} from "x402/types";
import { createPublicClient, http, publicActions } from "viem";
import { getLogger, recordMetric, recordHistogram } from "../telemetry.js";
import type { PoolManager } from "../pool-manager.js";
import type { RequestHandler } from "express";
import type { BalanceChecker } from "../balance-check.js";

const logger = getLogger();

/**
 * Verify request body
 */
type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

/**
 * Dependencies required by verify routes
 */
export interface VerifyRouteDependencies {
  poolManager: PoolManager;
  x402Config?: X402Config;
  balanceChecker?: BalanceChecker;
  /** RPC URLs per network (network name -> RPC URL) */
  rpcUrls?: Record<string, string>;
}

/**
 * Create verify routes
 *
 * @param deps - Dependencies for verify routes
 * @param rateLimiter - Rate limiting middleware
 * @param hookValidation - Hook whitelist validation middleware
 * @param feeValidation - Fee validation middleware
 * @returns Express Router with verify endpoints
 */
export function createVerifyRoutes(
  deps: VerifyRouteDependencies,
  rateLimiter: RateLimitRequestHandler,
  hookValidation?: RequestHandler,
  feeValidation?: RequestHandler,
): Router {
  const router = Router();

  /**
   * GET /verify - Returns info about the verify endpoint
   */
  router.get("/verify", (req: Request, res: Response) => {
    res.json({
      endpoint: "/verify",
      description: "POST to verify x402 payments",
      body: {
        paymentPayload: "PaymentPayload",
        paymentRequirements: "PaymentRequirements",
      },
    });
  });

  /**
   * POST /verify - Verify x402 payment payload (with rate limiting and validation)
   */
  const middlewares: Array<RequestHandler | RateLimitRequestHandler> = [rateLimiter];
  if (hookValidation) middlewares.push(hookValidation);
  if (feeValidation) middlewares.push(feeValidation);

  router.post("/verify", ...(middlewares as any), async (req: Request, res: Response) => {
    try {
      const body: VerifyRequest = req.body;
      const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
      const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

      // Verify that this is an EVM network
      if (!SupportedEVMNetworks.includes(paymentRequirements.network)) {
        throw new Error("Invalid network. Only EVM networks are supported.");
      }

      // Create connected client for EVM network with custom RPC URL support
      const chain = evm.getChainFromNetwork(paymentRequirements.network);
      const rpcUrl = deps.rpcUrls?.[paymentRequirements.network] || chain.rpcUrls?.default?.http?.[0];
      const client: ConnectedClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      }).extend(publicActions) as unknown as ConnectedClient;

      // verify
      const startTime = Date.now();
      logger.info(
        {
          network: paymentRequirements.network,
          extra: paymentRequirements.extra,
        },
        "Verifying payment...",
      );

      const valid = await verify(client, paymentPayload, paymentRequirements, deps.x402Config);

      // If basic verification passed and balance checker is available, check user balance
      if (valid.isValid && deps.balanceChecker) {
        try {
          const balanceCheck = await deps.balanceChecker.checkBalance(
            client,
            valid.payer as `0x${string}`,
            paymentRequirements.asset as `0x${string}`,
            paymentRequirements.maxAmountRequired,
            paymentRequirements.network,
          );

          if (!balanceCheck.hasSufficient) {
            logger.warn(
              {
                payer: valid.payer,
                network: paymentRequirements.network,
                balance: balanceCheck.balance,
                required: balanceCheck.required,
                cached: balanceCheck.cached,
              },
              "Insufficient balance detected during verification",
            );

            // Override verification result
            valid.isValid = false;
            valid.invalidReason = "insufficient_funds";
          } else {
            logger.debug(
              {
                payer: valid.payer,
                network: paymentRequirements.network,
                balance: balanceCheck.balance,
                required: balanceCheck.required,
                cached: balanceCheck.cached,
              },
              "Balance check passed during verification",
            );
          }
        } catch (error) {
          logger.error(
            {
              error,
              payer: valid.payer,
              network: paymentRequirements.network,
            },
            "Balance check failed during verification, proceeding with verification result",
          );
          // If balance check fails, we don't override the verification result
          // This ensures verification can still work even if balance check has issues
        }
      }

      const duration = Date.now() - startTime;

      // Record metrics
      recordMetric("facilitator.verify.total", 1, {
        network: paymentRequirements.network,
        is_valid: String(valid.isValid),
      });
      recordHistogram("facilitator.verify.duration_ms", duration, {
        network: paymentRequirements.network,
      });

      logger.info(
        {
          isValid: valid.isValid,
          payer: valid.payer,
          invalidReason: valid.invalidReason,
          duration_ms: duration,
        },
        "Verification result",
      );

      if (!valid.isValid) {
        logger.warn(
          {
            invalidReason: valid.invalidReason,
            payer: valid.payer,
          },
          "Verification failed",
        );
      }

      res.json(valid);
    } catch (error) {
      logger.error({ error }, "Verify error");
      recordMetric("facilitator.verify.errors", 1, {
        error_type: error instanceof Error ? error.name : "unknown",
      });

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
        if (message.includes("network") || message.includes("account")) {
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
