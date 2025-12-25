/**
 * Commitment calculation utility for X402 Settlement
 * Simplified using @x402x/extensions
 */

// Re-export from @x402x/extensions for backward compatibility
export {
  type CommitmentParams,
  calculateCommitment,
  generateSalt,
  validateCommitmentParams,
} from "@x402x/extensions";
