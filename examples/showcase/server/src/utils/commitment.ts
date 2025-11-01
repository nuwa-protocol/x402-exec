/**
 * Commitment calculation utility for X402 Settlement
 * Generates cryptographic commitments binding all settlement parameters to client signature
 */

import { ethers } from 'ethers';
import { randomBytes } from 'crypto';

export interface CommitmentParams {
  chainId: number;
  hub: string;
  token: string;
  from: string;
  value: string;
  validAfter: string;
  validBefore: string;
  salt: string;
  payTo: string;
  facilitatorFee: string;
  hook: string;
  hookData: string;
}

/**
 * Calculate commitment hash for X402 settlement
 * This hash becomes the EIP-3009 nonce, binding all business parameters to the client signature
 * 
 * @param params - All settlement parameters
 * @returns bytes32 commitment hash
 */
export function calculateCommitment(params: CommitmentParams): string {
  // Pack parameters in exact order as in SettlementRouter.sol
  return ethers.keccak256(
    ethers.solidityPacked(
      [
        "string",    // Protocol identifier
        "uint256",   // Chain ID
        "address",   // Hub address
        "address",   // Token address
        "address",   // From (payer)
        "uint256",   // Value
        "uint256",   // Valid after
        "uint256",   // Valid before
        "bytes32",   // Salt
        "address",   // Pay to
        "uint256",   // Facilitator fee
        "address",   // Hook
        "bytes32"    // keccak256(hookData)
      ],
      [
        "X402/settle/v1",
        params.chainId,
        params.hub,
        params.token,
        params.from,
        params.value,
        params.validAfter,
        params.validBefore,
        params.salt,
        params.payTo,
        params.facilitatorFee,
        params.hook,
        ethers.keccak256(params.hookData)
      ]
    )
  );
}

/**
 * Generate a random salt for settlement uniqueness
 * @returns bytes32 hex string
 */
export function generateSalt(): string {
  return ethers.hexlify(randomBytes(32));
}

/**
 * Validate commitment parameters
 * @param params - Commitment parameters to validate
 * @throws Error if validation fails
 */
export function validateCommitmentParams(params: CommitmentParams): void {
  if (!ethers.isAddress(params.hub)) {
    throw new Error('Invalid hub address');
  }
  if (!ethers.isAddress(params.token)) {
    throw new Error('Invalid token address');
  }
  if (!ethers.isAddress(params.from)) {
    throw new Error('Invalid from address');
  }
  if (!ethers.isAddress(params.payTo)) {
    throw new Error('Invalid payTo address');
  }
  if (!ethers.isAddress(params.hook)) {
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
  if (!ethers.isHexString(params.salt, 32)) {
    throw new Error('Invalid salt: must be bytes32');
  }
  
  if (!ethers.isHexString(params.hookData)) {
    throw new Error('Invalid hookData: must be hex string');
  }
}

