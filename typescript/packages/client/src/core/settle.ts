/**
 * Settle payment with facilitator
 *
 * This module handles the settlement of signed payment payloads with the
 * facilitator's /settle endpoint, following the x402 protocol.
 */

import type { Address, Hex } from "viem";
import { settle as coreSettle, toCanonicalNetworkKey } from "@x402x/core_v2";
import type {
  SignedAuthorization,
  SettleResult,
  PaymentPayload,
  PaymentRequirements,
} from "../types.js";
import { FacilitatorError } from "../errors.js";

/**
 * EVM Exact Scheme Authorization structure
 * Standard x402 v2 authorization format for EIP-3009
 */
interface ExactEvmAuthorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
}

/**
 * EVM Exact Scheme Payload structure
 * Standard x402 v2 payload format
 */
interface ExactEvmPayload {
  signature: Hex;
  authorization: ExactEvmAuthorization;
}

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
    // Convert network to CAIP-2 format for v2 protocol
    const canonicalNetwork = toCanonicalNetworkKey(signed.settlement.network);

    // Calculate total amount (business amount + facilitator fee)
    // This MUST match what was used in commitment calculation
    const totalAmount = (
      BigInt(signed.settlement.amount) + BigInt(signed.settlement.facilitatorFee)
    ).toString();

    // Construct standard x402 v2 PaymentPayload
    // Using standard EVM exact scheme payload structure
    const exactEvmPayload: ExactEvmPayload = {
      signature: signed.signature,
      authorization: {
        from: signed.authorization.from,
        to: signed.authorization.to,
        value: signed.authorization.value,
        validAfter: signed.authorization.validAfter,
        validBefore: signed.authorization.validBefore,
        nonce: signed.authorization.nonce,
      },
    };

    const paymentPayload: PaymentPayload = {
      x402Version: 2, // Use v2 protocol
      resource: {
        url: "https://x402x.dev/serverless",
        description: "x402x Serverless Settlement",
        mimeType: "application/json",
      },
      accepted: {
        scheme: "exact",
        network: canonicalNetwork as any, // Type cast required: core_v2 Network type accepts both CAIP-2 and legacy formats
        asset: signed.settlement.asset as Address,
        amount: totalAmount, // Use totalAmount to match commitment calculation
        payTo: signed.settlement.networkConfig.settlementRouter as Address,
        maxTimeoutSeconds: 300,
        extra: {},
      },
      // Standard EVM exact scheme payload
      payload: exactEvmPayload as any, // Type cast required: ExactEvmPayload structure matches v2 protocol
    };

    // Construct PaymentRequirements (for serverless mode verification)
    // IMPORTANT: Use totalAmount (amount + fee) to match commitment calculation
    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network: canonicalNetwork as any, // Type cast required: core_v2 Network type accepts CAIP-2 format
      amount: totalAmount, // Total amount including facilitator fee
      asset: signed.settlement.asset as Address,
      payTo: signed.settlement.networkConfig.settlementRouter as Address,
      maxTimeoutSeconds: 300, // 5 minutes
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

    // Call core's settle method with standard x402 v2 payload structure
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
