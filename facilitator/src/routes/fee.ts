/**
 * Fee Query Routes
 *
 * Provides endpoints for querying minimum facilitator fee requirements.
 */

import { Router, Request, Response } from "express";
import { getLogger, traced, recordMetric } from "../telemetry.js";
import { calculateMinFacilitatorFee, type GasCostConfig } from "../gas-cost.js";
import { getNetworkConfig } from "@x402x/core";
import type { DynamicGasPriceConfig } from "../dynamic-gas-price.js";
import type { TokenPriceConfig } from "../token-price.js";

const logger = getLogger();

/**
 * Dependencies required by fee routes
 */
export interface FeeRouteDependencies {
  gasCost: GasCostConfig;
  dynamicGasPrice: DynamicGasPriceConfig;
  tokenPrice: TokenPriceConfig;
}

/**
 * Create fee query routes
 *
 * @param deps - Dependencies for fee routes
 * @returns Express Router with fee endpoints
 */
export function createFeeRoutes(deps: FeeRouteDependencies): Router {
  const router = Router();

  /**
   * GET /calculate-fee?network={network}&hook={hook}&hookData={hookData}
   *
   * Calculate recommended facilitator fee for a specific network, hook, and optional hookData.
   * The returned fee has sufficient safety margin to ensure settlement will succeed.
   */
  router.get("/calculate-fee", async (req: Request, res: Response) => {
    try {
      const { network, hook, hookData } = req.query;

      // Validate required parameters
      if (!network || typeof network !== "string") {
        return res.status(400).json({
          error: "Invalid request",
          message: "Missing or invalid 'network' query parameter",
        });
      }

      if (!hook || typeof hook !== "string") {
        return res.status(400).json({
          error: "Invalid request",
          message: "Missing or invalid 'hook' query parameter",
        });
      }

      // hookData is optional, validate if provided
      if (hookData !== undefined && typeof hookData !== "string") {
        return res.status(400).json({
          error: "Invalid request",
          message: "Invalid 'hookData' query parameter (must be hex string)",
        });
      }

      // Validate network is supported
      try {
        getNetworkConfig(network);
      } catch (error) {
        return res.status(400).json({
          error: "Invalid network",
          message: `Network '${network}' is not supported`,
          network,
        });
      }

      // Get token decimals (USDC has 6 decimals)
      const tokenDecimals = 6;

      // Calculate minimum facilitator fee
      let feeCalculation;
      try {
        feeCalculation = await traced(
          "fee.calculate",
          async () =>
            calculateMinFacilitatorFee(
              network,
              hook,
              tokenDecimals,
              deps.gasCost,
              deps.dynamicGasPrice,
              deps.tokenPrice,
            ),
          { network, hook },
        );
      } catch (error) {
        logger.warn(
          {
            error,
            network,
            hook,
          },
          "Failed to calculate minimum facilitator fee",
        );

        // Check if it's a hook whitelist error
        if (error instanceof Error && error.message.includes("whitelist")) {
          return res.status(200).json({
            network,
            hook,
            hookAllowed: false,
            error: "Hook not in whitelist",
            message: error.message,
          });
        }

        return res.status(400).json({
          error: "Calculation failed",
          message: error instanceof Error ? error.message : "Failed to calculate minimum fee",
          network,
          hook,
        });
      }

      // Record metric
      recordMetric("facilitator.fee.query", 1, {
        network,
        hookAllowed: String(feeCalculation.hookAllowed),
      });

      // Get token info
      const networkConfig = getNetworkConfig(network);

      // Calculate fee validity period (60 seconds recommended)
      const validitySeconds = 60;
      const calculatedAt = new Date().toISOString();

      // Return successful response - only essential information
      const response = {
        network,
        hook,
        hookData: hookData || undefined,
        hookAllowed: feeCalculation.hookAllowed,
        // Main result - recommended facilitator fee
        facilitatorFee: feeCalculation.minFacilitatorFee,
        facilitatorFeeUSD: feeCalculation.minFacilitatorFeeUSD,
        // Metadata
        calculatedAt,
        validitySeconds,
        token: {
          address: networkConfig.usdc.address,
          symbol: "USDC",
          decimals: tokenDecimals,
        },
        // Note: breakdown and prices removed to avoid exposing internal cost structure
      };

      logger.debug(
        {
          network,
          hook,
          hookData,
          facilitatorFee: response.facilitatorFee,
          facilitatorFeeUSD: response.facilitatorFeeUSD,
          validitySeconds,
          // Log internal breakdown for monitoring
          breakdown: {
            gasLimit: feeCalculation.gasLimit,
            gasPrice: feeCalculation.gasPrice,
            gasCostUSD: feeCalculation.gasCostUSD,
            safetyMultiplier: feeCalculation.safetyMultiplier,
            finalCostUSD: feeCalculation.finalCostUSD,
          },
        },
        "Facilitator fee calculated",
      );

      res.json(response);
    } catch (error) {
      logger.error({ error }, "Error in calculate-fee endpoint");
      res.status(500).json({
        error: "Internal error",
        message: "Failed to calculate facilitator fee",
      });
    }
  });

  return router;
}
