/**
 * Commitment calculation utility for X402 Settlement
 * Simplified using @x402x/core_v2
 */

// Re-export from @x402x/core_v2 for backward compatibility
export {
  type CommitmentParams,
  calculateCommitment,
  generateSalt,
  validateCommitmentParams,
} from "@x402x/core_v2";
