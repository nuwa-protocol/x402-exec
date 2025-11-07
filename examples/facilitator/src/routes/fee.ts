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

const logger = getLogger();

/**
 * Dependencies required by fee routes
 */
export interface FeeRouteDependencies {
  gasCost: GasCostConfig;
  dynamicGasPrice: DynamicGasPriceConfig;
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
   * GET /min-facilitator-fee?network={network}&hook={hook}
   *
   * Query minimum facilitator fee for a specific network and hook
   */
  router.get("/min-facilitator-fee", async (req: Request, res: Response) => {
    try {
      const { network, hook } = req.query;

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

      // Return successful response
      const response = {
        network,
        hook,
        hookAllowed: feeCalculation.hookAllowed,
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
        token: {
          address: networkConfig.usdc.address,
          symbol: "USDC",
          decimals: tokenDecimals,
        },
        prices: {
          nativeToken: deps.gasCost.nativeTokenPrice[network]?.toFixed(2) || "0.00",
          timestamp: new Date().toISOString(),
        },
      };

      logger.debug(
        {
          network,
          hook,
          minFacilitatorFee: response.minFacilitatorFee,
          minFacilitatorFeeUSD: response.minFacilitatorFeeUSD,
        },
        "Minimum facilitator fee calculated",
      );

      res.json(response);
    } catch (error) {
      logger.error({ error }, "Error in min-facilitator-fee endpoint");
      res.status(500).json({
        error: "Internal error",
        message: "Failed to calculate minimum facilitator fee",
      });
    }
  });

  return router;
}
