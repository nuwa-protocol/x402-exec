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
import type { PoolManager } from "../pool-manager.js";
import type { FeeClaimConfig } from "../fee-claim.js";
import { getPendingFees, claimFees, type ClaimFeesRequest } from "../fee-claim.js";

const logger = getLogger();

/**
 * Dependencies required by fee routes
 */
export interface FeeRouteDependencies {
  gasCost: GasCostConfig;
  dynamicGasPrice: DynamicGasPriceConfig;
  tokenPrice: TokenPriceConfig;
  poolManager: PoolManager;
  allowedSettlementRouters: Record<string, string[]>;
  feeClaim: FeeClaimConfig;
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

      // Get token decimals dynamically from network config
      const networkConfig = getNetworkConfig(network);
      const tokenDecimals = networkConfig.defaultAsset.decimals;

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
          address: networkConfig.defaultAsset.address,
          name: networkConfig.defaultAsset.eip712.name,
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

  /**
   * GET /pending-fees?network={network}
   *
   * Query pending fees across all supported networks and tokens.
   * Returns fees that are eligible for claiming (above minimum threshold).
   */
  router.get("/pending-fees", async (req: Request, res: Response) => {
    try {
      const { network } = req.query;
      const networks = network ? [network as string] : undefined;

      // Validate network if specified
      if (network && typeof network === "string") {
        try {
          getNetworkConfig(network);
        } catch {
          return res.status(400).json({
            error: "Invalid network",
            message: `Network '${network}' is not supported`,
            network,
          });
        }
      }

      // Query pending fees
      const pendingFees = await traced(
        "fee.pending.query",
        async () =>
          getPendingFees(deps.poolManager, deps.allowedSettlementRouters, deps.feeClaim, networks),
        { networksCount: networks?.length || "all" },
      );

      // Record metric
      recordMetric("facilitator.pending_fees.query", 1, {
        networksCount: networks?.length || "all",
        pendingFeesCount: pendingFees.length,
      });

      // Get facilitator address (from first network's pool if available)
      let facilitatorAddress = "";
      if (deps.poolManager.getEvmAccountPools().size > 0) {
        const firstPool = deps.poolManager.getEvmAccountPools().values().next().value;
        if (firstPool) {
          facilitatorAddress = await firstPool.execute(async (signer) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const walletClient = signer as any;
            return walletClient.account?.address || walletClient.address;
          });
        }
      }

      // Calculate total pending amount
      const totalPending = pendingFees.reduce((sum, fee) => sum + fee.amount, 0n);

      const response = {
        facilitator: facilitatorAddress,
        networksQueried: networks || "all",
        pendingFees: pendingFees.map((fee) => ({
          ...fee,
          amount: fee.amount.toString(),
          amountUSD: fee.amountUSD,
        })),
        totalPending: totalPending.toString(),
        timestamp: new Date().toISOString(),
      };

      logger.debug(
        {
          facilitator: facilitatorAddress,
          networksQueried: networks || "all",
          pendingFeesCount: pendingFees.length,
          totalPending: totalPending.toString(),
        },
        "Pending fees queried successfully",
      );

      res.json(response);
    } catch (error) {
      logger.error({ error }, "Error in pending-fees endpoint");
      res.status(500).json({
        error: "Internal error",
        message: "Failed to query pending fees",
      });
    }
  });

  /**
   * POST /claim-fees
   *
   * Claim accumulated facilitator fees from SettlementRouter contracts.
   * Claims fees across all eligible networks and tokens by default.
   */
  router.post("/claim-fees", async (req: Request, res: Response) => {
    try {
      const { networks, tokens }: ClaimFeesRequest = req.body || {};

      // Validate networks if specified
      if (networks) {
        for (const network of networks) {
          try {
            getNetworkConfig(network);
          } catch {
            return res.status(400).json({
              error: "Invalid network",
              message: `Network '${network}' is not supported`,
              network,
            });
          }
        }
      }

      // Validate tokens if specified (basic format validation)
      if (tokens) {
        for (const token of tokens) {
          if (!token.startsWith("0x") || token.length !== 42) {
            return res.status(400).json({
              error: "Invalid token address",
              message: `Token address '${token}' is not a valid Ethereum address`,
              token,
            });
          }
        }
      }

      // Execute fee claiming
      const result = await traced(
        "fee.claim.execute",
        async () =>
          claimFees(deps.poolManager, deps.allowedSettlementRouters, deps.feeClaim, {
            networks,
            tokens,
          }),
        { networksCount: networks?.length || "all", tokensCount: tokens?.length || "all" },
      );

      // Record metric
      recordMetric("facilitator.fees.claimed", 1, {
        success: String(result.success),
        claimsCount: result.claims.length,
        totalClaimed: result.totalClaimed.toString(),
      });

      const response = {
        success: result.success,
        claims: result.claims.map((claim) => ({
          network: claim.network,
          token: claim.token,
          amount: claim.amount.toString(),
          transaction: claim.transaction,
          status: claim.status,
          ...(claim.error && { error: claim.error }),
        })),
        totalClaimed: result.totalClaimed.toString(),
        timestamp: new Date().toISOString(),
      };

      logger.info(
        {
          success: result.success,
          claimsCount: result.claims.length,
          totalClaimed: result.totalClaimed.toString(),
          networks: networks || "all",
          tokens: tokens || "all",
        },
        "Fee claiming operation completed",
      );

      res.json(response);
    } catch (error) {
      logger.error({ error }, "Error in claim-fees endpoint");
      res.status(500).json({
        error: "Internal error",
        message: "Failed to claim fees",
      });
    }
  });

  return router;
}
