/**
 * Settlement Router Integration Module
 *
 * This module provides functions for detecting and handling settlement mode payments
 * that use the SettlementRouter contract for extended business logic via Hooks.
 *
 * Most functionality is re-exported from @x402x/core with added logging.
 */

import type { PaymentPayload, PaymentRequirements, SettleResponse, Signer } from "x402/types";
import { isEvmSignerWallet } from "x402/types";
import {
  isSettlementMode as isSettlementModeCore,
  validateSettlementRouter as validateSettlementRouterCore,
  settleWithRouter as settleWithRouterCore,
  type GasMetrics,
  type SettleResponseWithMetrics,
} from "@x402x/core";
import { SettlementExtraError } from "./types.js";
import { getLogger } from "./telemetry.js";

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
 * Wrapper around @x402x/core's settleWithRouter with additional logging and observability.
 * The core implementation:
 * 1. Validates SettlementRouter address against whitelist (SECURITY)
 * 2. Verifies the EIP-3009 authorization
 * 3. Transfers tokens from payer to Router
 * 4. Deducts facilitator fee
 * 5. Executes the Hook with remaining amount
 * 6. Ensures Router doesn't hold funds
 *
 * @param signer - The facilitator's wallet signer (must support EVM)
 * @param paymentPayload - The payment payload with authorization and signature
 * @param paymentRequirements - The payment requirements with settlement extra parameters
 * @param allowedRouters - Whitelist of allowed SettlementRouter addresses per network
 * @param nativeTokenPrices - Optional native token prices by network (for gas metrics)
 * @returns SettleResponse indicating success or failure with gas metrics
 * @throws Error if the payment is for non-EVM network or settlement fails
 */
export async function settleWithRouter(
  signer: Signer,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  allowedRouters: Record<string, string[]>,
  nativeTokenPrices?: Record<string, number>,
): Promise<SettleResponseWithMetrics> {
  const logger = getLogger();

  try {
    // Ensure signer is EVM signer
    if (!isEvmSignerWallet(signer)) {
      throw new Error("Settlement Router requires an EVM signer");
    }

    logger.debug(
      {
        network: paymentRequirements.network,
        router: paymentRequirements.extra?.settlementRouter,
      },
      "Starting settlement with router",
    );

    // Use @x402x/core's settleWithRouter (includes validation)
    const result = await settleWithRouterCore(signer as any, paymentPayload, paymentRequirements, {
      allowedRouters,
    });

    // Enhance gas metrics with actual native token price if available
    if (result.success && result.gasMetrics && nativeTokenPrices) {
      const network = paymentRequirements.network;
      const nativePrice = nativeTokenPrices[network];

      if (nativePrice && nativePrice > 0) {
        // Recalculate USD values with actual token price
        const actualGasCostNative = parseFloat(result.gasMetrics.actualGasCostNative);
        const actualGasCostUSD = (actualGasCostNative * nativePrice).toFixed(6);
        const facilitatorFeeUSD = result.gasMetrics.facilitatorFeeUSD;
        const profitUSD = (parseFloat(facilitatorFeeUSD) - parseFloat(actualGasCostUSD)).toFixed(6);
        const profitMarginPercent =
          parseFloat(facilitatorFeeUSD) > 0
            ? ((parseFloat(profitUSD) / parseFloat(facilitatorFeeUSD)) * 100).toFixed(2)
            : "0.00";

        // Update gas metrics
        result.gasMetrics.actualGasCostUSD = actualGasCostUSD;
        result.gasMetrics.profitUSD = profitUSD;
        result.gasMetrics.profitMarginPercent = profitMarginPercent;
        result.gasMetrics.profitable = parseFloat(profitUSD) >= 0;
        result.gasMetrics.nativeTokenPriceUSD = nativePrice.toFixed(2);
      }
    }

    // Log settlement success with gas metrics
    if (result.success && result.gasMetrics) {
      const metrics = result.gasMetrics;

      logger.info(
        {
          transaction: result.transaction,
          payer: result.payer,
          network: paymentRequirements.network,
          hook: paymentRequirements.extra?.hook,
          gasMetrics: {
            gasUsed: metrics.gasUsed,
            effectiveGasPrice: metrics.effectiveGasPrice,
            actualGasCostNative: metrics.actualGasCostNative,
            actualGasCostUSD: metrics.actualGasCostUSD,
            facilitatorFee: metrics.facilitatorFee,
            facilitatorFeeUSD: metrics.facilitatorFeeUSD,
            profitUSD: metrics.profitUSD,
            profitMarginPercent: metrics.profitMarginPercent,
            profitable: metrics.profitable,
          },
        },
        "SettlementRouter transaction confirmed with gas metrics",
      );

      // Warn if unprofitable
      if (!metrics.profitable) {
        const lossPercent = Math.abs(parseFloat(metrics.profitMarginPercent));
        logger.warn(
          {
            transaction: result.transaction,
            network: paymentRequirements.network,
            hook: metrics.hook,
            facilitatorFeeUSD: metrics.facilitatorFeeUSD,
            actualGasCostUSD: metrics.actualGasCostUSD,
            lossUSD: metrics.profitUSD,
            lossPercent: `${lossPercent}%`,
          },
          "⚠️ UNPROFITABLE SETTLEMENT: Facilitator fee did not cover gas costs",
        );
      }
    } else {
      // Log without gas metrics (fallback)
      logger.info(
        {
          transaction: result.transaction,
          payer: result.payer,
          success: result.success,
        },
        "SettlementRouter transaction confirmed",
      );
    }

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
