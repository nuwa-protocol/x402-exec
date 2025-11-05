/**
 * Commitment calculation utility for X402 Settlement
 * Simplified using @x402x/core
 */

// Re-export from @x402x/core for backward compatibility
export {
  type CommitmentParams,
  calculateCommitment,
  generateSalt,
  validateCommitmentParams,
} from '@x402x/core';
