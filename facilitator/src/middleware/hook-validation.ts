/**
 * Hook Whitelist Validation Middleware
 *
 * Validates that hooks are in the whitelist to prevent malicious Hook gas attacks.
 */

import type { Request, Response, NextFunction } from "express";
import type { PaymentRequirements } from "x402/types";
import { getLogger } from "../telemetry.js";
import { isHookAllowed, type GasCostConfig } from "../gas-cost.js";
import { isSettlementMode } from "../settlement.js";

const logger = getLogger();

/**
 * Create hook validation middleware
 *
 * @param config - Gas cost configuration (includes hook whitelist)
 * @returns Express middleware function
 */
export function createHookValidationMiddleware(config: GasCostConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if hook whitelist is disabled
      if (!config.hookWhitelistEnabled) {
        return next();
      }

      // Get payment requirements from request body
      const paymentRequirements: PaymentRequirements | undefined = req.body?.paymentRequirements;

      if (!paymentRequirements) {
        return res.status(400).json({
          error: "Invalid request",
          message: "Missing paymentRequirements in request body",
        });
      }

      // Skip if not settlement mode
      if (!isSettlementMode(paymentRequirements)) {
        return next();
      }

      // Extract hook address
      const hook = paymentRequirements.extra?.hook;
      if (!hook || typeof hook !== "string") {
        return res.status(400).json({
          error: "Invalid request",
          message: "Missing or invalid hook address in settlement extra parameters",
        });
      }

      // Check if hook is allowed
      const network = paymentRequirements.network;
      const allowed = isHookAllowed(network, hook, config);

      if (!allowed) {
        logger.warn(
          {
            network,
            hook,
            allowedHooks: config.allowedHooks[network] || [],
          },
          "Hook not in whitelist",
        );

        return res.status(403).json({
          error: "Forbidden",
          message: `Hook ${hook} is not in whitelist for network ${network}. This hook is not supported for security reasons.`,
          allowedHooks: config.allowedHooks[network] || [],
        });
      }

      // Hook is valid, proceed
      logger.debug(
        {
          network,
          hook,
        },
        "Hook validated successfully",
      );

      next();
    } catch (error) {
      logger.error({ error }, "Error in hook validation middleware");
      res.status(500).json({
        error: "Internal error",
        message: "Failed to validate hook",
      });
    }
  };
}
