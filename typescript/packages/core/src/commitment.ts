/**
 * Commitment calculation utilities
 * 
 * The commitment hash binds all settlement parameters to the client's signature,
 * preventing parameter tampering attacks.
 */

import { keccak256, encodePacked, type Hex } from 'viem';
import type { CommitmentParams } from './types.js';

/**
 * Calculate commitment hash for x402x settlement
 * 
 * This hash becomes the EIP-3009 nonce, cryptographically binding all settlement
 * parameters to the client's signature. The parameter order must exactly match
 * SettlementRouter.sol.
 * 
 * @param params - All settlement parameters
 * @returns bytes32 commitment hash
 * 
 * @example
 * ```typescript
 * const commitment = calculateCommitment({
 *   chainId: 84532,
 *   hub: '0x...',
 *   token: '0x...',
 *   from: '0x...',
 *   value: '100000',
 *   validAfter: '0',
 *   validBefore: '1234567890',
 *   salt: '0x...',
 *   payTo: '0x...',
 *   facilitatorFee: '10000',
 *   hook: '0x...',
 *   hookData: '0x',
 * });
 * ```
 */
export function calculateCommitment(params: CommitmentParams): string {
  // Pack parameters in exact order as in SettlementRouter.sol
  return keccak256(
    encodePacked(
      [
        'string',   // Protocol identifier
        'uint256',  // Chain ID
        'address',  // Hub address
        'address',  // Token address
        'address',  // From (payer)
        'uint256',  // Value
        'uint256',  // Valid after
        'uint256',  // Valid before
        'bytes32',  // Salt
        'address',  // Pay to
        'uint256',  // Facilitator fee
        'address',  // Hook
        'bytes32'   // keccak256(hookData)
      ],
      [
        'X402/settle/v1',
        BigInt(params.chainId),
        params.hub as Hex,
        params.token as Hex,
        params.from as Hex,
        BigInt(params.value),
        BigInt(params.validAfter),
        BigInt(params.validBefore),
        params.salt as Hex,
        params.payTo as Hex,
        BigInt(params.facilitatorFee),
        params.hook as Hex,
        keccak256(params.hookData as Hex)
      ]
    )
  );
}

/**
 * Generate a random salt for settlement uniqueness
 * 
 * Works in both Node.js and browser environments.
 * 
 * @returns bytes32 hex string (0x + 64 hex characters)
 * 
 * @example
 * ```typescript
 * const salt = generateSalt();
 * // => '0x1234567890abcdef...'
 * ```
 */
export function generateSalt(): string {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    // Browser environment: use Web Crypto API
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    return `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }
  
  // Node.js environment: use crypto module
  if (typeof require !== 'undefined') {
    try {
      const { randomBytes } = require('crypto');
      return `0x${randomBytes(32).toString('hex')}`;
    } catch (err) {
      // Fall through to error
    }
  }
  
  throw new Error('Unable to generate random bytes: neither Web Crypto API nor Node.js crypto module is available');
}

/**
 * Validate commitment parameters
 * 
 * @param params - Commitment parameters to validate
 * @throws Error if validation fails
 */
export function validateCommitmentParams(params: CommitmentParams): void {
  // Validate addresses
  if (!isValidAddress(params.hub)) {
    throw new Error('Invalid hub address');
  }
  if (!isValidAddress(params.token)) {
    throw new Error('Invalid token address');
  }
  if (!isValidAddress(params.from)) {
    throw new Error('Invalid from address');
  }
  if (!isValidAddress(params.payTo)) {
    throw new Error('Invalid payTo address');
  }
  if (!isValidAddress(params.hook)) {
    throw new Error('Invalid hook address');
  }
  
  // Validate numeric values
  try {
    BigInt(params.value);
    BigInt(params.validAfter);
    BigInt(params.validBefore);
    BigInt(params.facilitatorFee);
  } catch (e) {
    throw new Error('Invalid numeric parameter');
  }
  
  // Validate bytes32 values
  if (!isValidHex(params.salt) || params.salt.length !== 66) {
    throw new Error('Invalid salt: must be bytes32 (0x + 64 hex chars)');
  }
  
  if (!isValidHex(params.hookData)) {
    throw new Error('Invalid hookData: must be hex string');
  }
}

/**
 * Check if a string is a valid Ethereum address
 */
function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Check if a string is a valid hex string
 */
function isValidHex(hex: string): boolean {
  return /^0x[0-9a-fA-F]*$/.test(hex);
}

