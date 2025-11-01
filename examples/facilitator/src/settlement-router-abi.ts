/**
 * SettlementRouter Contract ABI
 *
 * This file contains the ABI for interacting with the SettlementRouter contract.
 * Only includes the essential functions needed by the facilitator.
 */

export const settlementRouterAbi = [
  // ===== Core Functions =====

  /**
   * Main settlement function with Hook execution
   */
  {
    type: "function",
    name: "settleAndExecute",
    inputs: [
      { name: "token", type: "address" },
      { name: "from", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
      { name: "salt", type: "bytes32" },
      { name: "payTo", type: "address" },
      { name: "facilitatorFee", type: "uint256" },
      { name: "hook", type: "address" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  /**
   * Check if a payment has been settled (idempotency check)
   */
  {
    type: "function",
    name: "isSettled",
    inputs: [{ name: "contextKey", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },

  /**
   * Batch claim accumulated facilitator fees
   */
  {
    type: "function",
    name: "claimFees",
    inputs: [{ name: "tokens", type: "address[]" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  /**
   * Get pending fees for a facilitator
   */
  {
    type: "function",
    name: "getPendingFees",
    inputs: [
      { name: "facilitator", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  /**
   * Calculate context key for idempotency checking
   */
  {
    type: "function",
    name: "calculateContextKey",
    inputs: [
      { name: "from", type: "address" },
      { name: "token", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "pure",
  },

  // ===== Events =====

  /**
   * Emitted when a settlement is successfully completed
   */
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "contextKey", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "hook", type: "address", indexed: false },
      { name: "salt", type: "bytes32", indexed: false },
      { name: "payTo", type: "address", indexed: false },
      { name: "facilitatorFee", type: "uint256", indexed: false },
    ],
  },

  /**
   * Emitted when a Hook is successfully executed
   */
  {
    type: "event",
    name: "HookExecuted",
    inputs: [
      { name: "contextKey", type: "bytes32", indexed: true },
      { name: "hook", type: "address", indexed: true },
      { name: "returnData", type: "bytes", indexed: false },
    ],
  },

  /**
   * Emitted when facilitator fees are accumulated
   */
  {
    type: "event",
    name: "FeeAccumulated",
    inputs: [
      { name: "facilitator", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },

  /**
   * Emitted when facilitator claims accumulated fees
   */
  {
    type: "event",
    name: "FeesClaimed",
    inputs: [
      { name: "facilitator", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
