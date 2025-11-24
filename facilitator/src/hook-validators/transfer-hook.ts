/**
 * TransferHook Validator
 *
 * Validates TransferHook parameters without requiring on-chain calls.
 * TransferHook executes simple transfers to multiple recipients.
 */

import { decodeAbiParameters, isAddress } from "viem";
import type { HookValidator, HookValidationResult, BuiltInHookType } from "./types.js";

/**
 * TransferHook parameters structure
 */
interface TransferHookParams {
  /** Recipient addresses */
  recipients: string[];
  /** Amounts to transfer to each recipient */
  amounts: bigint[];
}

/**
 * TransferHook Validator implementation
 */
export class TransferHookValidator implements HookValidator {
  /**
   * Decode TransferHook parameters from hookData
   *
   * @param hookData - ABI-encoded parameters: (address[] recipients, uint256[] amounts), or empty/"0x" for payTo-only transfer
   * @returns Decoded parameters, or null if hookData is empty (payTo-only transfer)
   * @throws Error if decoding fails and hookData is not empty
   */
  private decodeHookData(hookData: string): TransferHookParams | null {
    // Empty or "0x" hookData means payTo-only transfer
    if (!hookData || hookData === "0x" || hookData === "") {
      return null; // Indicates payTo-only transfer
    }

    try {
      const decoded = decodeAbiParameters(
        [{ type: "address[]" }, { type: "uint256[]" }],
        hookData as `0x${string}`,
      );

      return {
        recipients: decoded[0] as string[],
        amounts: decoded[1] as bigint[],
      };
    } catch (error) {
      throw new Error(
        `Failed to decode TransferHook data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Validate TransferHook parameters
   *
   * @param network - Network name
   * @param hookAddress - Hook contract address
   * @param hookData - Encoded hook parameters
   * @param hookAmount - Total amount available for transfers
   * @returns Validation result
   */
  validate(
    network: string,
    hookAddress: string,
    hookData: string,
    hookAmount: bigint,
  ): HookValidationResult {
    try {
      // Decode parameters
      const params = this.decodeHookData(hookData);

      // If params is null, it means payTo-only transfer (empty hookData)
      if (params === null) {
        // For payTo-only transfer, hookAmount should be the full payment amount
        // No additional validation needed for empty hookData
        return {
          isValid: true,
        };
      }

      // Validate array lengths match
      if (params.recipients.length !== params.amounts.length) {
      return {
        isValid: false,
        errorReason: `Recipients and amounts length mismatch: ${params.recipients.length} vs ${params.amounts.length}`,
      };
      }

      // Validate array is not empty
      if (params.recipients.length === 0) {
        return {
          isValid: false,
          errorReason: "Recipients array cannot be empty",
        };
      }

      // Validate recipient addresses
      for (let i = 0; i < params.recipients.length; i++) {
        const recipient = params.recipients[i];
        if (!isAddress(recipient)) {
        return {
          isValid: false,
          errorReason: `Invalid recipient address at index ${i}: ${recipient}`,
        };
        }

        // Check for zero address (though technically valid, usually indicates error)
        if (recipient === "0x0000000000000000000000000000000000000000") {
          return {
            isValid: false,
            errorReason: `Zero address not allowed as recipient at index ${i}`,
          };
        }
      }

      // Validate amounts
      let totalAmount = 0n;
      for (let i = 0; i < params.amounts.length; i++) {
        const amount = params.amounts[i];

        // Check for negative amounts (shouldn't happen with uint256, but defensive check)
        if (amount < 0n) {
          return {
            isValid: false,
            errorReason: `Negative amount not allowed at index ${i}: ${amount}`,
          };
        }

        // Check for zero amounts
        if (amount === 0n) {
          return {
            isValid: false,
            errorReason: `Zero amount not allowed at index ${i}`,
          };
        }

        totalAmount += amount;
      }

      // Validate total amount matches hookAmount
      if (totalAmount !== hookAmount) {
        return {
          isValid: false,
          errorReason: `Total transfer amount mismatch: expected ${hookAmount}, got ${totalAmount}`,
        };
      }

      // All validations passed
      return {
        isValid: true,
      };
    } catch (error) {
      return {
        isValid: false,
        errorReason: `TransferHook validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

}
