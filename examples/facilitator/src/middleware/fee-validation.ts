/**
 * Fee Validation Middleware
 *
 * Validates that facilitator fee meets minimum requirements based on gas cost calculations.
 */

import type { Request, Response, NextFunction } from "express";
import type { PaymentRequirements } from "x402/types";
import { getLogger } from "../telemetry.js";
import { calculateMinFacilitatorFee, type GasCostConfig } from "../gas-cost.js";
import { isSettlementMode } from "../settlement.js";
import { getNetworkConfig } from "@x402x/core";
import type { DynamicGasPriceConfig } from "../dynamic-gas-price.js";

const logger = getLogger();

/**
 * Create fee validation middleware
 *
 * @param config - Gas cost configuration
 * @param dynamicConfig - Dynamic gas price configuration
 * @returns Express middleware function
 */
export function createFeeValidationMiddleware(
  config: GasCostConfig,
  dynamicConfig: DynamicGasPriceConfig,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if validation is disabled
      if (!config.enabled) {
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

      // Extract settlement parameters
      const hook = paymentRequirements.extra?.hook;
      const facilitatorFee = paymentRequirements.extra?.facilitatorFee;
      const network = paymentRequirements.network;

      if (!hook || typeof hook !== "string") {
        return res.status(400).json({
          error: "Invalid request",
          message: "Missing or invalid hook address in settlement extra parameters",
        });
      }

      if (!facilitatorFee || typeof facilitatorFee !== "string") {
        return res.status(400).json({
          error: "Invalid request",
          message: "Missing or invalid facilitatorFee in settlement extra parameters",
        });
      }

      // Get token decimals
      const networkConfig = getNetworkConfig(network);
      const tokenDecimals = 6; // USDC has 6 decimals (networkConfig.usdc would have this info)

      // Calculate minimum required fee
      let feeCalculation;
      try {
        feeCalculation = await calculateMinFacilitatorFee(
          network,
          hook,
          tokenDecimals,
          config,
          dynamicConfig,
        );
      } catch (error) {
        logger.error({ error, network, hook }, "Failed to calculate minimum facilitator fee");
        return res.status(400).json({
          error: "Invalid request",
          message: error instanceof Error ? error.message : "Failed to calculate minimum fee",
        });
      }

      // Compare fees
      const providedFee = BigInt(facilitatorFee);
      const requiredFee = BigInt(feeCalculation.minFacilitatorFee);

      if (providedFee < requiredFee) {
        logger.warn(
          {
            network,
            hook,
            providedFee: facilitatorFee,
            requiredFee: feeCalculation.minFacilitatorFee,
            requiredFeeUSD: feeCalculation.minFacilitatorFeeUSD,
          },
          "Facilitator fee below minimum requirement",
        );

        return res.status(400).json({
          error: "Insufficient facilitator fee",
          message: `Facilitator fee ${facilitatorFee} is below minimum requirement ${feeCalculation.minFacilitatorFee} (${feeCalculation.minFacilitatorFeeUSD} USD)`,
          providedFee: facilitatorFee,
          minFacilitatorFee: feeCalculation.minFacilitatorFee,
          minFacilitatorFeeUSD: feeCalculation.minFacilitatorFeeUSD,
          breakdown: {
            gasLimit: feeCalculation.gasLimit,
            maxGasLimit: feeCalculation.maxGasLimit,
            gasPrice: feeCalculation.gasPrice,
            gasCostNative: feeCalculation.gasCostNative,
            gasCostUSD: feeCalculation.gasCostUSD,
            safetyMultiplier: feeCalculation.safetyMultiplier,
            finalCostUSD: feeCalculation.finalCostUSD,
          },
        });
      }

      // Fee is sufficient, proceed
      logger.debug(
        {
          network,
          hook,
          providedFee: facilitatorFee,
          requiredFee: feeCalculation.minFacilitatorFee,
        },
        "Facilitator fee validated successfully",
      );

      next();
    } catch (error) {
      logger.error({ error }, "Error in fee validation middleware");
      res.status(500).json({
        error: "Internal error",
        message: "Failed to validate facilitator fee",
      });
    }
  };
}
