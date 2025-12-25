/**
 * Legacy compatibility types and stubs for x402x v2 middleware
 * 
 * These provide compatibility shims for patterns from x402 v1 that are not
 * part of the v2 API but are needed by x402x middleware implementations.
 */

import type { Network } from "@x402/core/types";

/**
 * Supported EVM networks (legacy v1 pattern)
 * In v2, networks use CAIP-2 format (e.g., 'eip155:84532')
 */
export const SupportedEVMNetworks: Network[] = [
  "eip155:84532", // Base Sepolia
  "eip155:1444673419", // SKALE Base Sepolia
  "eip155:8453", // Base Mainnet
];

/**
 * Money schema validator (legacy v1 pattern)
 * In v2, validation is typically done through zod schemas in @x402/core
 */
export const moneySchema = {
  parse: (value: unknown): string | number => {
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
    throw new Error("Invalid money value");
  },
};

/**
 * Settle response header name (legacy v1 pattern)
 * In v2, this is typically handled by x402HTTPResourceServer
 */
export const settleResponseHeader = "X-Payment-Response";

/**
 * EVM utilities placeholder (legacy v1 pattern)
 * In v2, EVM functionality is provided by @x402/evm package
 */
export const evm = {
  /**
   * Check if a value is a valid EVM address
   */
  isAddress: (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    return /^0x[a-fA-F0-9]{40}$/.test(value);
  },
};

/**
 * Payment scheme stub (legacy v1 pattern)
 * In v2, schemes are implemented as classes extending SchemeNetworkClient/Server
 */
export const exact = {
  name: "exact" as const,
  // Additional scheme properties would go here
};

/**
 * Chain ID to network mapping (legacy v1 pattern)
 */
export const ChainIdToNetwork: Record<number, Network> = {
  84532: "eip155:84532", // Base Sepolia
  1444673419: "eip155:1444673419", // SKALE Base Sepolia  
  8453: "eip155:8453", // Base Mainnet
};

/**
 * Check if a signer is a multi-network signer
 */
export function isMultiNetworkSigner(signer: unknown): boolean {
  // Simple type guard - would need more sophisticated logic in production
  return !!(signer && typeof signer === "object" && "signTransaction" in signer);
}

/**
 * Check if a signer is an SVM (Solana) signer wallet
 */
export function isSvmSignerWallet(signer: unknown): boolean {
  // Simple type guard for Solana wallets
  return !!(signer && typeof signer === "object" && "publicKey" in signer);
}

/**
 * Multi-network signer interface (legacy v1 pattern)
 */
export interface MultiNetworkSigner {
  address?: string;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  [key: string]: unknown;
}

/**
 * X402 configuration interface (legacy v1 pattern)
 */
export interface X402Config {
  signer?: MultiNetworkSigner;
  [key: string]: unknown;
}

/**
 * Payment requirements selector type (legacy v1 pattern)
 */
export type PaymentRequirementsSelector = (requirements: unknown[]) => unknown;

/**
 * Create payment header (legacy v1 stub)
 * In v2, this is handled by x402Client.createPaymentPayload()
 */
export function createPaymentHeader(_requirements: unknown, _signer: unknown): Promise<string> {
  // This should not be called in v2 - kept for compatibility during migration
  throw new Error("createPaymentHeader is not implemented in v2 - use x402Client instead");
}

/**
 * Select payment requirements (legacy v1 stub)
 * In v2, this is handled by x402Client.createPaymentPayload()
 */
export function selectPaymentRequirements(
  _requirements: unknown[],
  _selector?: PaymentRequirementsSelector,
): unknown {
  // This should not be called in v2 - kept for compatibility during migration
  throw new Error("selectPaymentRequirements is not implemented in v2 - use x402Client instead");
}

/**
 * Decode X-Payment-Response header (legacy v1 stub)
 * In v2, response handling is done through x402HTTPClient
 */
export function decodeXPaymentResponse(_header: string): unknown {
  // This should not be called in v2 - kept for compatibility during migration
  throw new Error("decodeXPaymentResponse is not implemented in v2 - use x402HTTPClient instead");
}

/**
 * Use facilitator for verification (legacy v1 stub)
 * In v2, this is handled through FacilitatorClient
 */
export function useFacilitator(_config: unknown) {
  // This should not be called in v2 - kept for compatibility during migration
  throw new Error("useFacilitator is not implemented in v2 - use FacilitatorClient instead");
}

/**
 * Create a signer instance (legacy v1 stub)
 */
export function createSigner(_config: unknown): unknown {
  // This should not be called in v2 - kept for compatibility during migration
  throw new Error("createSigner is not implemented in v2 - use appropriate v2 signer patterns");
}
