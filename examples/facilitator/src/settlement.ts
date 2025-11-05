/**
 * Settlement Router Integration Module
 *
 * This module provides functions for detecting and handling settlement mode payments
 * that use the SettlementRouter contract for extended business logic via Hooks.
 * 
 * Now simplified using @x402x/core SDK.
 */

import { parseErc6492Signature, type Address, type Hex } from "viem";
import type { PaymentPayload, PaymentRequirements, SettleResponse, Signer } from "x402/types";
import { isEvmSignerWallet } from "x402/types";
import { 
  isSettlementMode as isSettlementModeCore,
  settleWithRouter as settleWithRouterCore,
  validateSettlementRouter as validateSettlementRouterCore,
  SETTLEMENT_ROUTER_ABI
} from "@x402x/core";
import { SettlementExtraError } from "./types.js";

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
 * Simplified wrapper around @x402x/core's validateSettlementRouter
 *
 * @param network - The network name (e.g., "base-sepolia", "x-layer-testnet")
 * @param routerAddress - The SettlementRouter address to validate
 * @param allowedRouters - Whitelist of allowed router addresses per network
 * @throws SettlementExtraError if router address is not in whitelist
 */
export function validateSettlementRouter(
  network: string,
  routerAddress: string,
  allowedRouters: Record<string, string[]>
): void {
  const allowedForNetwork = allowedRouters[network];
  
  if (!allowedForNetwork || allowedForNetwork.length === 0) {
    throw new SettlementExtraError(
      `No allowed settlement routers configured for network: ${network}. ` +
      `Please configure environment variables for this network.`
    );
  }
  
  const normalizedRouter = routerAddress.toLowerCase();
  const isAllowed = allowedForNetwork.some(
    allowed => allowed.toLowerCase() === normalizedRouter
  );
  
  if (!isAllowed) {
    throw new SettlementExtraError(
      `Settlement router ${routerAddress} is not in whitelist for network ${network}. ` +
      `Allowed addresses: ${allowedForNetwork.join(', ')}`
    );
  }
  
  console.log(`✅ Settlement router validated: ${routerAddress} for network: ${network}`);
}

/**
 * Settle payment using SettlementRouter contract
 *
 * This function uses @x402x/core's settleWithRouter to:
 * 1. Validate SettlementRouter address against whitelist (SECURITY)
 * 2. Verify the EIP-3009 authorization
 * 3. Transfer tokens from payer to Router
 * 4. Deduct facilitator fee
 * 5. Execute the Hook with remaining amount
 * 6. Ensure Router doesn't hold funds
 *
 * @param signer - The facilitator's wallet signer (must support EVM)
 * @param paymentPayload - The payment payload with authorization and signature
 * @param paymentRequirements - The payment requirements with settlement extra parameters
 * @param allowedRouters - Whitelist of allowed SettlementRouter addresses per network
 * @returns SettleResponse indicating success or failure
 * @throws Error if the payment is for non-EVM network or settlement fails
 */
export async function settleWithRouter(
  signer: Signer,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  allowedRouters: Record<string, string[]>,
): Promise<SettleResponse> {
  try {
    // Validate SettlementRouter address against whitelist
    if (!paymentRequirements.extra?.settlementRouter) {
      throw new SettlementExtraError("Missing settlementRouter in payment requirements");
    }
    
    validateSettlementRouter(
      paymentRequirements.network, 
      paymentRequirements.extra.settlementRouter,
      allowedRouters
    );

    // Ensure signer is EVM signer
    if (!isEvmSignerWallet(signer)) {
      throw new Error("Settlement Router requires an EVM signer");
    }

    // Use @x402x/core's settleWithRouter
    const walletClient = signer as any;
    const result = await settleWithRouterCore(
      walletClient, 
      paymentPayload, 
      paymentRequirements,
      { allowedRouters }
    );
    
    console.log("SettlementRouter transaction confirmed:", {
      transaction: result.transaction,
      success: result.success,
    });

    return {
      success: true,
      transaction: result.transaction,
      network: paymentPayload.network,
      payer: result.payer,
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
