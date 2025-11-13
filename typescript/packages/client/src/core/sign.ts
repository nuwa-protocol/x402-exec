/**
 * Sign EIP-3009 authorization for settlement
 *
 * This module handles the signing of EIP-712 typed data for EIP-3009
 * transferWithAuthorization, using the commitment hash as the nonce.
 */

import type { Address, WalletClient } from "viem";
import { getAddress } from "viem";
import { signTypedData } from "viem/actions";
import type { SettlementData, SignedAuthorization } from "../types.js";
import { SigningError } from "../errors.js";

/**
 * EIP-3009 authorization types for EIP-712 signature
 */
const AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/**
 * Sign EIP-3009 authorization
 *
 * This function signs an EIP-712 typed data message for EIP-3009's
 * transferWithAuthorization function. The commitment hash is used
 * as the nonce to cryptographically bind all settlement parameters.
 *
 * @param wallet - Wallet client from wagmi/viem
 * @param settlement - Prepared settlement data
 * @returns Signed authorization ready to submit
 *
 * @throws SigningError if signing fails or wallet doesn't support signing
 *
 * @example
 * ```typescript
 * import { signAuthorization } from '@x402x/client';
 *
 * const signed = await signAuthorization(walletClient, settlement);
 * console.log('Signature:', signed.signature);
 * ```
 */
export async function signAuthorization(
  wallet: WalletClient,
  settlement: SettlementData,
): Promise<SignedAuthorization> {
  try {
    // Ensure wallet has an account
    if (!wallet.account) {
      throw new SigningError("Wallet client must have an account");
    }

    // Build EIP-712 domain
    const domain = {
      name: settlement.networkConfig.usdc.name,
      version: settlement.networkConfig.usdc.version,
      chainId: settlement.networkConfig.chainId,
      verifyingContract: getAddress(settlement.token),
    };

    // Build EIP-712 message
    // The "to" address is the SettlementRouter (not the final recipient)
    // The "value" MUST be total amount (business amount + facilitator fee)
    // because the Router needs to deduct the fee before passing to Hook
    const totalAmount = BigInt(settlement.amount) + BigInt(settlement.facilitatorFee);
    const message = {
      from: getAddress(settlement.from),
      to: getAddress(settlement.networkConfig.settlementRouter),
      value: totalAmount,
      validAfter: BigInt(settlement.validAfter),
      validBefore: BigInt(settlement.validBefore),
      nonce: settlement.commitment, // Use commitment as nonce
    };

    console.log("[x402x/client] EIP-712 Message for signing:", {
      from: message.from,
      to: message.to,
      value: message.value.toString(),
      validAfter: message.validAfter.toString(),
      validBefore: message.validBefore.toString(),
      nonce: message.nonce,
    });

    // Sign typed data
    const signature = await signTypedData(wallet, {
      account: wallet.account,
      domain,
      types: AUTHORIZATION_TYPES,
      primaryType: "TransferWithAuthorization",
      message,
    });

    // Build authorization object
    const authorization = {
      from: settlement.from,
      to: settlement.networkConfig.settlementRouter as Address,
      value: totalAmount.toString(), // Use total amount (business + fee)
      validAfter: settlement.validAfter,
      validBefore: settlement.validBefore,
      nonce: settlement.commitment,
    };

    return {
      settlement,
      signature,
      authorization,
    };
  } catch (error) {
    if (error instanceof SigningError) {
      throw error;
    }

    // Handle common signing errors
    if (error instanceof Error) {
      if (error.message.includes("User rejected")) {
        throw new SigningError("User rejected the signing request", "USER_REJECTED");
      }
      if (error.message.includes("account")) {
        throw new SigningError("Wallet account not available", "NO_ACCOUNT");
      }
      throw new SigningError(`Failed to sign authorization: ${error.message}`, "SIGNING_FAILED");
    }

    throw new SigningError("Failed to sign authorization: Unknown error", "UNKNOWN_ERROR");
  }
}
