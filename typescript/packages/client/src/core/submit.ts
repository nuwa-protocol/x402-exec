/**
 * Submit signed authorization to facilitator
 *
 * This module handles the submission of signed payment payloads to the
 * facilitator's /settle endpoint, following the x402 protocol.
 */

import type { Address, Hex } from "viem";
import type {
  SignedAuthorization,
  SubmitResult,
  PaymentPayload,
  PaymentRequirements,
} from "../types.js";
import { FacilitatorError } from "../errors.js";
import { formatFacilitatorUrl } from "./utils.js";

/**
 * Submit signed authorization to facilitator for settlement
 *
 * This function:
 * 1. Constructs the PaymentPayload according to x402 protocol
 * 2. Constructs the PaymentRequirements with settlement extra
 * 3. POSTs to facilitator's /settle endpoint
 * 4. Parses and returns the settlement result
 *
 * @param facilitatorUrl - Facilitator URL
 * @param signed - Signed authorization from signAuthorization
 * @param timeout - Optional timeout in milliseconds (default: 30000)
 * @returns Submit result with transaction hash
 *
 * @throws FacilitatorError if request fails or facilitator returns error
 *
 * @example
 * ```typescript
 * import { submitToFacilitator } from '@x402x/client';
 *
 * const result = await submitToFacilitator(
 *   'https://facilitator.x402x.dev',
 *   signed
 * );
 * console.log('TX Hash:', result.transaction);
 * ```
 */
export async function submitToFacilitator(
  facilitatorUrl: string,
  signed: SignedAuthorization,
  timeout: number = 30000,
): Promise<SubmitResult> {
  const url = `${formatFacilitatorUrl(facilitatorUrl)}/settle`;

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
      asset: signed.settlement.token as Address,
      payTo: signed.settlement.networkConfig.settlementRouter as Address,
      maxTimeoutSeconds: 300, // 5 minutes
      // Required by x402 protocol (even though not used in serverless mode)
      // In the future, the x402 v2 will remove the resource field from the payment requirements
      // (https://github.com/coinbase/x402/pull/446)
      resource: "https://x402x.dev/serverless", // Placeholder for serverless mode
      description: "x402x Serverless Settlement",
      mimeType: "application/json",
      extra: {
        name: signed.settlement.networkConfig.usdc.name,
        version: signed.settlement.networkConfig.usdc.version,
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

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // POST to facilitator
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentPayload,
        paymentRequirements,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const result: any = await response.json();

    if (!response.ok) {
      throw new FacilitatorError(
        result.error || result.message || "Facilitator request failed",
        "FACILITATOR_ERROR",
        response.status,
        result,
      );
    }

    // Validate result structure
    if (typeof result.success !== "boolean") {
      throw new FacilitatorError(
        "Invalid response from facilitator: missing success field",
        "INVALID_RESPONSE",
        response.status,
        result,
      );
    }

    if (!result.success) {
      throw new FacilitatorError(
        result.errorReason || "Settlement failed",
        "SETTLEMENT_FAILED",
        response.status,
        result,
      );
    }

    if (!result.transaction) {
      throw new FacilitatorError(
        "Invalid response from facilitator: missing transaction hash",
        "INVALID_RESPONSE",
        response.status,
        result,
      );
    }

    return {
      success: result.success,
      transaction: result.transaction as Hex,
      network: result.network || signed.settlement.network,
      payer: result.payer || signed.settlement.from,
      errorReason: result.errorReason,
    };
  } catch (error) {
    if (error instanceof FacilitatorError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new FacilitatorError(`Facilitator request timed out after ${timeout}ms`, "TIMEOUT");
      }
      if (error.message.includes("fetch")) {
        throw new FacilitatorError(`Network error: ${error.message}`, "NETWORK_ERROR");
      }
      throw new FacilitatorError(
        `Failed to submit to facilitator: ${error.message}`,
        "UNKNOWN_ERROR",
      );
    }

    throw new FacilitatorError("Failed to submit to facilitator: Unknown error", "UNKNOWN_ERROR");
  }
}
