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
import type { TokenPriceConfig } from "../token-price.js";

const logger = getLogger();

/**
 * Create fee validation middleware
 *
 * @param config - Gas cost configuration
 * @param dynamicConfig - Dynamic gas price configuration
 * @param tokenPriceConfig - Token price configuration
 * @returns Express middleware function
 */
export function createFeeValidationMiddleware(
  config: GasCostConfig,
  dynamicConfig: DynamicGasPriceConfig,
  tokenPriceConfig: TokenPriceConfig,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
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
      //const networkConfig = getNetworkConfig(network);
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
          tokenPriceConfig,
        );
      } catch (error) {
        logger.error({ error, network, hook }, "Failed to calculate minimum facilitator fee");
        return res.status(400).json({
          error: "Invalid request",
          message: error instanceof Error ? error.message : "Failed to calculate minimum fee",
        });
      }

      // Compare fees with tolerance
      const providedFee = BigInt(facilitatorFee);
      const requiredFee = BigInt(feeCalculation.minFacilitatorFee);

      // Apply validation tolerance: threshold = requiredFee * (1 - tolerance)
      // This allows for small price fluctuations between fee calculation and validation
      const toleranceMultiplier = 1 - config.validationTolerance;
      const threshold = BigInt(Math.floor(Number(requiredFee) * toleranceMultiplier));

      if (providedFee < threshold) {
        logger.warn(
          {
            network,
            hook,
            providedFee: facilitatorFee,
            requiredFee: feeCalculation.minFacilitatorFee,
            requiredFeeUSD: feeCalculation.minFacilitatorFeeUSD,
            threshold: threshold.toString(),
            validationTolerance: config.validationTolerance,
            tolerancePercent: `${(config.validationTolerance * 100).toFixed(1)}%`,
          },
          "Facilitator fee below minimum requirement (with tolerance)",
        );

        return res.status(400).json({
          error: "Insufficient facilitator fee",
          message: `Facilitator fee ${facilitatorFee} is below minimum requirement ${feeCalculation.minFacilitatorFee} (${feeCalculation.minFacilitatorFeeUSD} USD) with ${(config.validationTolerance * 100).toFixed(1)}% tolerance`,
          providedFee: facilitatorFee,
          minFacilitatorFee: feeCalculation.minFacilitatorFee,
          minFacilitatorFeeUSD: feeCalculation.minFacilitatorFeeUSD,
          threshold: threshold.toString(),
          validationTolerance: config.validationTolerance,
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
          threshold: threshold.toString(),
          validationTolerance: config.validationTolerance,
          margin: `${(((Number(providedFee) - Number(threshold)) / Number(threshold)) * 100).toFixed(2)}%`,
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
