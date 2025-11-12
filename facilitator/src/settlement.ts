/**
 * Settlement Router Integration Module
 *
 * This module provides functions for detecting and handling settlement mode payments
 * that use the SettlementRouter contract for extended business logic via Hooks.
 *
 * Wraps @x402x/core functionality with additional logging and gas metrics calculation.
 */

import type { PaymentPayload, PaymentRequirements, Signer } from "x402/types";
import { isEvmSignerWallet } from "x402/types";
import {
  isSettlementMode as isSettlementModeCore,
  validateSettlementRouter as validateSettlementRouterCore,
  settleWithRouter as settleWithRouterCore,
  SettlementExtraError,
} from "@x402x/core";
import { getLogger } from "./telemetry.js";
import { calculateGasMetrics } from "./gas-metrics.js";
import type { SettleResponseWithMetrics } from "./settlement-types.js";
import { calculateEffectiveGasLimit, type GasCostConfig } from "./gas-cost.js";
import { getGasPrice, type DynamicGasPriceConfig } from "./dynamic-gas-price.js";

/**
 * Check if a payment request requires SettlementRouter mode
 *
 * Re-exported from @x402x/core for backward compatibility
 *
 * @param paymentRequirements - The payment requirements from the 402 response
 * @returns True if settlement mode is required (extra.settlementRouter exists)
 */
export function isSettlementMode(paymentRequirements: PaymentRequirements): boolean {
  return isSettlementModeCore(paymentRequirements);
}

/**
 * Validate SettlementRouter address against whitelist
 *
 * Wrapper around @x402x/core's validateSettlementRouter with additional logging
 *
 * @param network - The network name (e.g., "base-sepolia", "x-layer-testnet")
 * @param routerAddress - The SettlementRouter address to validate
 * @param allowedRouters - Whitelist of allowed router addresses per network
 * @throws SettlementExtraError if router address is not in whitelist
 */
export function validateSettlementRouter(
  network: string,
  routerAddress: string,
  allowedRouters: Record<string, string[]>,
): void {
  const logger = getLogger();

  try {
    // Use core validation logic
    validateSettlementRouterCore(network, routerAddress, allowedRouters);

    // Log success
    logger.info(
      {
        network,
        routerAddress,
      },
      "Settlement router validated",
    );
  } catch (error) {
    // Log validation failure
    logger.error(
      {
        network,
        routerAddress,
        allowedAddresses: allowedRouters[network] || [],
        error: error instanceof Error ? error.message : String(error),
      },
      "Settlement router validation failed",
    );
    throw error;
  }
}

/**
 * Settle payment using SettlementRouter contract
 *
 * Wrapper around @x402x/core's settleWithRouter with additional logging and gas metrics.
 * The core implementation:
 * 1. Validates SettlementRouter address against whitelist (SECURITY)
 * 2. Verifies the EIP-3009 authorization
 * 3. Transfers tokens from payer to Router
 * 4. Deducts facilitator fee
 * 5. Executes the Hook with remaining amount
 * 6. Ensures Router doesn't hold funds
 *
 * This facilitator wrapper adds:
 * - Dynamic gas limit calculation based on facilitator fee
 * - Gas cost tracking and profitability metrics
 * - Detailed logging for monitoring
 * - Warning on unprofitable settlements
 *
 * @param signer - The facilitator's wallet signer (must support EVM)
 * @param paymentPayload - The payment payload with authorization and signature
 * @param paymentRequirements - The payment requirements with settlement extra parameters
 * @param allowedRouters - Whitelist of allowed SettlementRouter addresses per network
 * @param gasCostConfig - Gas cost configuration for dynamic gas limit
 * @param dynamicGasPriceConfig - Dynamic gas price configuration
 * @param nativeTokenPrices - Optional native token prices by network (for gas metrics)
 * @returns SettleResponse with gas metrics for monitoring
 * @throws Error if the payment is for non-EVM network or settlement fails
 */
export async function settleWithRouter(
  signer: Signer,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  allowedRouters: Record<string, string[]>,
  gasCostConfig?: GasCostConfig,
  dynamicGasPriceConfig?: DynamicGasPriceConfig,
  nativeTokenPrices?: Record<string, number>,
): Promise<SettleResponseWithMetrics> {
  const logger = getLogger();

  try {
    // Ensure signer is EVM signer
    if (!isEvmSignerWallet(signer)) {
      throw new Error("Settlement Router requires an EVM signer");
    }

    const network = paymentRequirements.network;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extra = paymentRequirements.extra as any;
    const facilitatorFee = extra?.facilitatorFee || "0";

    logger.debug(
      {
        network,
        router: extra?.settlementRouter,
        facilitatorFee,
      },
      "Starting settlement with router",
    );

    // Calculate effective gas limit if config is provided
    let effectiveGasLimit: number | undefined;
    let gasLimitMode = "static";

    if (gasCostConfig && dynamicGasPriceConfig) {
      try {
        // Get current gas price for the network
        const gasPrice = await getGasPrice(network, gasCostConfig, dynamicGasPriceConfig);

        // Get native token price
        const nativePrice = nativeTokenPrices?.[network] || 0;

        // Calculate effective gas limit with triple constraints
        effectiveGasLimit = calculateEffectiveGasLimit(
          facilitatorFee,
          gasPrice,
          nativePrice,
          gasCostConfig,
        );

        gasLimitMode = gasCostConfig.enableDynamicGasLimit ? "dynamic" : "static";

        logger.debug(
          {
            network,
            facilitatorFee,
            gasPrice,
            nativePrice,
            effectiveGasLimit,
            mode: gasLimitMode,
            minGasLimit: gasCostConfig.minGasLimit,
            maxGasLimit: gasCostConfig.maxGasLimit,
            dynamicMargin: gasCostConfig.dynamicGasLimitMargin,
          },
          "Calculated effective gas limit for settlement",
        );
      } catch (error) {
        logger.warn(
          {
            error,
            network,
          },
          "Failed to calculate dynamic gas limit, using default",
        );
        // Continue with default gas limit
      }
    }

    // Call core settleWithRouter - this returns receipt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publicClient = signer as any;

    // Use @x402x/core's settleWithRouter (includes validation)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await settleWithRouterCore(signer as any, paymentPayload, paymentRequirements, {
      allowedRouters,
      gasLimit: effectiveGasLimit,
    });

    // If settlement succeeded, calculate gas metrics from the transaction
    if (result.success) {
      try {
        // Get the transaction receipt for gas metrics
        const receipt = await publicClient.waitForTransactionReceipt({ hash: result.transaction });

        // Extract facilitator fee and hook from payment requirements
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const extra = paymentRequirements.extra as any;
        const facilitatorFee = extra?.facilitatorFee || "0";
        const hook = extra?.hook || "";

        // Get native token price for this network
        const nativePrice = nativeTokenPrices?.[paymentRequirements.network] || 0;

        // Calculate gas metrics
        const gasMetrics = calculateGasMetrics(
          receipt,
          facilitatorFee,
          hook,
          paymentRequirements.network,
          nativePrice.toString(),
          6, // USDC decimals (all current settlements use USDC)
        );

        // Log settlement success with gas metrics
        logger.info(
          {
            transaction: result.transaction,
            payer: result.payer,
            network: paymentRequirements.network,
            hook,
            gasLimit: {
              value: effectiveGasLimit,
              mode: gasLimitMode,
            },
            gasMetrics: {
              gasUsed: gasMetrics.gasUsed,
              effectiveGasPrice: gasMetrics.effectiveGasPrice,
              actualGasCostNative: gasMetrics.actualGasCostNative,
              actualGasCostUSD: gasMetrics.actualGasCostUSD,
              facilitatorFee: gasMetrics.facilitatorFee,
              facilitatorFeeUSD: gasMetrics.facilitatorFeeUSD,
              profitUSD: gasMetrics.profitUSD,
              profitMarginPercent: gasMetrics.profitMarginPercent,
              profitable: gasMetrics.profitable,
            },
          },
          "SettlementRouter transaction confirmed with gas metrics",
        );

        // Warn if unprofitable
        if (!gasMetrics.profitable) {
          const lossPercent = Math.abs(parseFloat(gasMetrics.profitMarginPercent));
          logger.warn(
            {
              transaction: result.transaction,
              network: paymentRequirements.network,
              hook: gasMetrics.hook,
              facilitatorFeeUSD: gasMetrics.facilitatorFeeUSD,
              actualGasCostUSD: gasMetrics.actualGasCostUSD,
              lossUSD: gasMetrics.profitUSD,
              lossPercent: `${lossPercent}%`,
            },
            "⚠️ UNPROFITABLE SETTLEMENT: Facilitator fee did not cover gas costs",
          );
        }

        // Return result with gas metrics
        return {
          ...result,
          gasMetrics,
        };
      } catch (metricsError) {
        // If metrics calculation fails, log error but still return success
        logger.error(
          {
            error: metricsError,
            transaction: result.transaction,
          },
          "Failed to calculate gas metrics, returning settlement without metrics",
        );

        return result;
      }
    }

    // Settlement failed, return result without metrics
    return result;
  } catch (error) {
    logger.error(
      {
        error,
        network: paymentRequirements.network,
        router: paymentRequirements.extra?.settlementRouter,
      },
      "Error in settleWithRouter",
    );

    // Extract payer from payload if available
    let payer = "";
    try {
      const payload = paymentPayload.payload as {
        authorization: { from: string };
      };
      payer = payload.authorization.from;
    } catch {
      // Ignore extraction errors
    }

    return {
      success: false,
      errorReason:
        error instanceof SettlementExtraError
          ? "invalid_payment_requirements"
          : "unexpected_settle_error",
      transaction: "",
      network: paymentPayload.network,
      payer,
    };
  }
}
