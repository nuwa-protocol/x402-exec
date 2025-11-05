/**
 * ABI definitions for x402x contracts
 */

/**
 * Settlement Router ABI (minimal, only settleAndExecute function)
 * 
 * This ABI contains only the settleAndExecute function which is used by
 * facilitators to execute settlement transactions.
 */
export const SETTLEMENT_ROUTER_ABI = [
  {
    type: 'function',
    name: 'settleAndExecute',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'from', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
      { name: 'salt', type: 'bytes32' },
      { name: 'payTo', type: 'address' },
      { name: 'facilitatorFee', type: 'uint256' },
      { name: 'hook', type: 'address' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

