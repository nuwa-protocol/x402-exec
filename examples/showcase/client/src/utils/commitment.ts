/**
 * Commitment calculation utility for X402 Settlement (Client-side)
 * Generates cryptographic commitments binding all settlement parameters to client signature
 */

import { encodePacked, keccak256, isAddress, isHex } from 'viem';

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
 * CRITICAL: Parameter order must exactly match SettlementRouter.sol
 * 
 * @param params - All settlement parameters
 * @returns bytes32 commitment hash
 */
export function calculateCommitment(params: CommitmentParams): string {
  // Pack parameters in exact order as in SettlementRouter.sol
  // Solidity: keccak256(abi.encodePacked(...))
  return keccak256(
    encodePacked(
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
        BigInt(params.chainId),
        params.hub as `0x${string}`,
        params.token as `0x${string}`,
        params.from as `0x${string}`,
        BigInt(params.value),
        BigInt(params.validAfter),
        BigInt(params.validBefore),
        params.salt as `0x${string}`,
        params.payTo as `0x${string}`,
        BigInt(params.facilitatorFee),
        params.hook as `0x${string}`,
        keccak256(params.hookData as `0x${string}`)
      ]
    )
  );
}

/**
 * Validate commitment parameters
 * @param params - Commitment parameters to validate
 * @throws Error if validation fails
 */
export function validateCommitmentParams(params: CommitmentParams): void {
  if (!isAddress(params.hub)) {
    throw new Error('Invalid hub address');
  }
  if (!isAddress(params.token)) {
    throw new Error('Invalid token address');
  }
  if (!isAddress(params.from)) {
    throw new Error('Invalid from address');
  }
  if (!isAddress(params.payTo)) {
    throw new Error('Invalid payTo address');
  }
  if (!isAddress(params.hook)) {
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
  if (!isHex(params.salt, { strict: true }) || (params.salt.length !== 66)) {
    throw new Error('Invalid salt: must be bytes32 (0x + 64 hex chars)');
  }
  
  if (!isHex(params.hookData)) {
    throw new Error('Invalid hookData: must be hex string');
  }
}

