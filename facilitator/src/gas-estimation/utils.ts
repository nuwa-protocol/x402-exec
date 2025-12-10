/**
 * Gas Estimation Utilities
 *
 * Utility functions for gas estimation, including error parsing and common calculations.
 */

import type { BaseError } from "viem";

/**
 * Parse estimateGas error and extract a human-readable reason
 *
 * @param error - Error from walletClient.estimateGas
 * @returns Human-readable error reason
 */
export function parseEstimateGasError(error: unknown): string {
  // If it's not an error object, return generic message
  if (!error || typeof error !== 'object') {
    return 'Gas estimation failed - unknown error';
  }

  try {
    // Try to extract message from error object
    const message = (error as any).message || (error as any).details || '';

    // Check error message first (most reliable)
    const messageLower = message.toLowerCase();

    if (messageLower.includes('execution reverted')) {
      return 'Transaction execution reverted - check all parameters';
    }

    if (messageLower.includes('gas required exceeds allowance')) {
      return 'Gas limit exceeded - transaction too complex';
    }

    if (messageLower.includes('insufficient funds')) {
      return 'Insufficient funds for gas - check wallet balance';
    }

    if (messageLower.includes('nonce too low')) {
      return 'Nonce error - transaction ordering issue';
    }

    // Check for specific revert data signatures
    const revertData = (error as any).data || (error as any).cause?.data;
    if (typeof revertData === 'string') {
      // Try to decode common error signatures
      if (revertData.startsWith('0x08c379a0')) {
        // Error(string)
        // This is a standard Error(string) revert
        // The data after the selector contains the error message
        // For simplicity, return a generic message since full decoding would require more complex logic
        return 'Hook execution failed - invalid parameters or logic error';
      }

      if (revertData.startsWith('0x4e487b71')) {
        // Panic(uint256)
        return 'Hook execution panicked - potential gas limit or arithmetic error';
      }

      // Check for specific SettlementRouter errors
      if (revertData.includes('HookExecutionFailed')) {
        return 'Hook execution failed - check hook parameters and contract logic';
      }

      if (revertData.includes('TransferFailed')) {
        return 'Token transfer failed - insufficient balance or allowance';
      }

      if (revertData.includes('InvalidCommitment')) {
        return 'Invalid commitment - nonce or authorization mismatch';
      }

      if (revertData.includes('AlreadySettled')) {
        return 'Transaction already settled - duplicate attempt';
      }
    }

    // Generic error
    return `Gas estimation failed: ${message || 'Unknown error'}`;

  } catch (parseError) {
    // If parsing fails, return a safe fallback
    return 'Gas estimation failed - unable to determine cause';
  }
}
