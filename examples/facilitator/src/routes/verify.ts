/**
 * Verify Routes
 *
 * Provides verification endpoints for x402 payment payloads:
 * - GET /verify: Endpoint information
 * - POST /verify: Verify payment payload
 */

import { Router, Request, Response } from "express";
import { verify } from "x402/facilitator";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  createConnectedClient,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
  Signer,
  ConnectedClient,
  type X402Config,
} from "x402/types";
import { getLogger, recordMetric, recordHistogram } from "../telemetry.js";
import type { PoolManager } from "../pool-manager.js";

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
}

/**
 * Create verify routes
 *
 * @param deps - Dependencies for verify routes
 * @returns Express Router with verify endpoints
 */
export function createVerifyRoutes(deps: VerifyRouteDependencies): Router {
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
   * POST /verify - Verify x402 payment payload
   */
  router.post("/verify", async (req: Request, res: Response) => {
    try {
      const body: VerifyRequest = req.body;
      const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
      const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

      // use the correct client/signer based on the requested network
      // svm verify requires a Signer because it signs & simulates the txn
      let client: Signer | ConnectedClient;
      if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
        client = createConnectedClient(paymentRequirements.network);
      } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
        // Use account pool for SVM if available
        const pool = deps.poolManager.getPool(paymentRequirements.network);
        if (pool) {
          // Get a signer from the pool (will use round-robin/random selection)
          // For verify, we don't need serial execution, so we can just get the first signer
          const accountsInfo = pool.getAccountsInfo();
          if (accountsInfo.length > 0) {
            // Create a temporary signer for verification
            client = await pool.execute(async (signer) => signer);
          } else {
            throw new Error("No SVM accounts available");
          }
        } else {
          throw new Error(`No account pool for network: ${paymentRequirements.network}`);
        }
      } else {
        throw new Error("Invalid network");
      }

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
      res.status(400).json({
        error: "Invalid request",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

