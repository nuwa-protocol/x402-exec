/**
 * Settle payment with facilitator
 *
 * This module handles the settlement of signed payment payloads with the
 * facilitator's /settle endpoint, following the x402 protocol.
 */

import type { Address, Hex } from "viem";
import { settle as coreSettle } from "@x402x/core";
import type {
  SignedAuthorization,
  SettleResult,
  PaymentPayload,
  PaymentRequirements,
} from "../types.js";
import { FacilitatorError } from "../errors.js";

/**
 * Settle signed authorization with facilitator
 *
 * This function acts as a convenience wrapper that:
 * 1. Constructs the PaymentPayload according to x402 protocol
 * 2. Constructs the PaymentRequirements with settlement extra
 * 3. Calls core's settle() method to POST to facilitator's /settle endpoint
 * 4. Parses and returns the settlement result
 *
 * @param facilitatorUrl - Facilitator URL
 * @param signed - Signed authorization from signAuthorization
 * @param timeout - Optional timeout in milliseconds (default: 30000)
 * @returns Settlement result with transaction hash
 *
 * @throws FacilitatorError if request fails or facilitator returns error
 *
 * @example
 * ```typescript
 * import { settle } from '@x402x/client';
 *
 * const result = await settle(
 *   'https://facilitator.x402x.dev',
 *   signed
 * );
 * console.log('TX Hash:', result.transaction);
 * ```
 */
export async function settle(
  facilitatorUrl: string,
  signed: SignedAuthorization,
  timeout: number = 30000,
): Promise<SettleResult> {
  try {
    // Construct PaymentPayload
    const paymentPayload: PaymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: signed.settlement.network as any, // Network type compatibility
      payload: {
        signature: signed.signature,
        authorization: {
          from: signed.authorization.from,
          to: signed.authorization.to,
          value: signed.authorization.value,
          validAfter: signed.authorization.validAfter,
          validBefore: signed.authorization.validBefore,
          nonce: signed.authorization.nonce,
        },
      },
    };

    // Construct PaymentRequirements (for serverless mode verification)
    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network: signed.settlement.network as any, // Network type compatibility
      maxAmountRequired: signed.settlement.amount,
      asset: signed.settlement.asset as Address,
      payTo: signed.settlement.networkConfig.settlementRouter as Address,
      maxTimeoutSeconds: 300, // 5 minutes
      // Required by x402 protocol (even though not used in serverless mode)
      // In the future, the x402 v2 will remove the resource field from the payment requirements
      // (https://github.com/coinbase/x402/pull/446)
      resource: "https://x402x.dev/serverless", // Placeholder for serverless mode
      description: "x402x Serverless Settlement",
      mimeType: "application/json",
      extra: {
        name: signed.settlement.networkConfig.defaultAsset.eip712.name,
        version: signed.settlement.networkConfig.defaultAsset.eip712.version,
        settlementRouter: signed.settlement.networkConfig.settlementRouter as Address,
        salt: signed.settlement.salt,
        payTo: signed.settlement.payTo,
        facilitatorFee: signed.settlement.facilitatorFee,
        hook: signed.settlement.hook,
        hookData: signed.settlement.hookData,
      },
    };

    // Include payment requirements in payload (for stateless facilitator processing)
    paymentPayload.paymentRequirements = paymentRequirements;

    // Call core's settle method
    const result = await coreSettle(facilitatorUrl, paymentPayload, paymentRequirements, timeout);

    return {
      success: result.success,
      transaction: result.transaction as Hex,
      network: result.network || signed.settlement.network,
      payer: (result.payer || signed.settlement.from) as Address,
      errorReason: result.errorReason,
    };
  } catch (error) {
    if (error instanceof FacilitatorError) {
      throw error;
    }

    // Handle errors from core settle
    if (error instanceof Error) {
      throw new FacilitatorError(`Failed to settle payment: ${error.message}`, "SETTLEMENT_ERROR");
    }

    throw new FacilitatorError("Failed to settle payment: Unknown error", "UNKNOWN_ERROR");
  }
}
