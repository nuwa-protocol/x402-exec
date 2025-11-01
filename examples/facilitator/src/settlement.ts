/**
 * Settlement Router Integration Module
 *
 * This module provides functions for detecting and handling settlement mode payments
 * that use the SettlementRouter contract for extended business logic via Hooks.
 */

import { parseErc6492Signature, type Address, type Hex } from "viem";
import type { PaymentPayload, PaymentRequirements, SettleResponse, Signer } from "x402/types";
import { settlementRouterAbi } from "./settlement-router-abi";
import { SettlementExtra, SettlementExtraError } from "./types";

/**
 * Check if a payment request requires SettlementRouter mode
 *
 * @param paymentRequirements - The payment requirements from the 402 response
 * @returns True if settlement mode is required (extra.settlementRouter exists)
 */
export function isSettlementMode(paymentRequirements: PaymentRequirements): boolean {
  return !!paymentRequirements.extra?.settlementRouter;
}

/**
 * Parse and validate settlement extra parameters from PaymentRequirements
 *
 * @param extra - The extra field from PaymentRequirements
 * @returns Parsed and validated SettlementExtra parameters
 * @throws SettlementExtraError if required fields are missing or invalid
 */
export function parseSettlementExtra(extra: unknown): SettlementExtra {
  if (!extra || typeof extra !== "object") {
    throw new SettlementExtraError("Missing or invalid extra field");
  }

  const e = extra as Record<string, unknown>;

  // Validate required fields
  if (!e.settlementRouter || typeof e.settlementRouter !== "string") {
    throw new SettlementExtraError("Missing or invalid settlementRouter address");
  }

  if (!e.salt || typeof e.salt !== "string") {
    throw new SettlementExtraError("Missing or invalid salt (32 bytes hex required)");
  }

  if (!e.payTo || typeof e.payTo !== "string") {
    throw new SettlementExtraError("Missing or invalid payTo address");
  }

  if (!e.facilitatorFee || typeof e.facilitatorFee !== "string") {
    throw new SettlementExtraError("Missing or invalid facilitatorFee");
  }

  if (!e.hook || typeof e.hook !== "string") {
    throw new SettlementExtraError("Missing or invalid hook address");
  }

  if (!e.hookData || typeof e.hookData !== "string") {
    throw new SettlementExtraError("Missing or invalid hookData");
  }

  // Basic format validation
  if (!e.settlementRouter.startsWith("0x") || e.settlementRouter.length !== 42) {
    throw new SettlementExtraError("Invalid settlementRouter address format");
  }

  if (!e.salt.startsWith("0x") || e.salt.length !== 66) {
    throw new SettlementExtraError("Invalid salt format (must be 32 bytes hex)");
  }

  if (!e.payTo.startsWith("0x") || e.payTo.length !== 42) {
    throw new SettlementExtraError("Invalid payTo address format");
  }

  if (!e.hook.startsWith("0x") || e.hook.length !== 42) {
    throw new SettlementExtraError("Invalid hook address format");
  }

  if (!e.hookData.startsWith("0x")) {
    throw new SettlementExtraError("Invalid hookData format (must start with 0x)");
  }

  // Validate facilitatorFee is a valid number string
  try {
    BigInt(e.facilitatorFee);
  } catch {
    throw new SettlementExtraError("Invalid facilitatorFee (must be a numeric string)");
  }

  return {
    settlementRouter: e.settlementRouter,
    salt: e.salt,
    payTo: e.payTo,
    facilitatorFee: e.facilitatorFee,
    hook: e.hook,
    hookData: e.hookData,
  };
}

/**
 * Settle payment using SettlementRouter contract
 *
 * This function calls the SettlementRouter.settleAndExecute method which:
 * 1. Verifies the EIP-3009 authorization
 * 2. Transfers tokens from payer to Router
 * 3. Deducts facilitator fee
 * 4. Executes the Hook with remaining amount
 * 5. Ensures Router doesn't hold funds
 *
 * @param signer - The facilitator's wallet signer (must support EVM)
 * @param paymentPayload - The payment payload with authorization and signature
 * @param paymentRequirements - The payment requirements with settlement extra parameters
 * @returns SettleResponse indicating success or failure
 * @throws Error if the payment is for non-EVM network or settlement fails
 */
export async function settleWithRouter(
  signer: Signer,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<SettleResponse> {
  try {
    // 1. Parse settlement extra parameters
    const extra = parseSettlementExtra(paymentRequirements.extra);

    // 2. Extract authorization data from payload
    const payload = paymentPayload.payload as {
      authorization: {
        from: string;
        to: string;
        value: string;
        validAfter: string;
        validBefore: string;
        nonce: string;
      };
      signature: string;
    };

    const { authorization } = payload;

    // 3. Parse ERC-6492 signature if needed (returns original if not ERC-6492)
    const { signature } = parseErc6492Signature(payload.signature as Hex);

    // 4. Call SettlementRouter.settleAndExecute
    console.log("Calling SettlementRouter.settleAndExecute with params:", {
      router: extra.settlementRouter,
      token: paymentRequirements.asset,
      from: authorization.from,
      value: authorization.value,
      salt: extra.salt,
      payTo: extra.payTo,
      facilitatorFee: extra.facilitatorFee,
      hook: extra.hook,
    });

    const tx = await signer.writeContract({
      address: extra.settlementRouter as Address,
      abi: settlementRouterAbi,
      functionName: "settleAndExecute",
      args: [
        paymentRequirements.asset as Address, // token
        authorization.from as Address, // from
        BigInt(authorization.value), // value
        BigInt(authorization.validAfter), // validAfter
        BigInt(authorization.validBefore), // validBefore
        authorization.nonce as Hex, // nonce (commitment hash)
        signature, // signature
        extra.salt as Hex, // salt
        extra.payTo as Address, // payTo
        BigInt(extra.facilitatorFee), // facilitatorFee
        extra.hook as Address, // hook
        extra.hookData as Hex, // hookData
      ],
    });

    console.log("SettlementRouter transaction sent:", tx);

    // 5. Wait for transaction confirmation
    const receipt = await signer.waitForTransactionReceipt({ hash: tx });

    console.log("SettlementRouter transaction confirmed:", {
      hash: tx,
      status: receipt.status,
    });

    if (receipt.status !== "success") {
      return {
        success: false,
        errorReason: "invalid_transaction_state",
        transaction: tx,
        network: paymentPayload.network,
        payer: authorization.from,
      };
    }

    return {
      success: true,
      transaction: tx,
      network: paymentPayload.network,
      payer: authorization.from,
    };
  } catch (error) {
    console.error("Error in settleWithRouter:", error);

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
