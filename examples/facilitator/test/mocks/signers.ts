/**
 * Mock Signers
 *
 * Mock implementations of EVM and SVM signers for testing
 */

import type { Signer } from "x402/types";
import { vi } from "vitest";

/**
 * Create a mock EVM signer with configurable behavior
 */
export function createMockEvmSigner(options?: {
  address?: string;
  signMessageResolve?: any;
  signMessageReject?: Error;
  sendTransactionResolve?: string;
  sendTransactionReject?: Error;
}): Signer {
  const address = options?.address || "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";

  const signMessage = vi.fn();
  if (options?.signMessageReject) {
    signMessage.mockRejectedValue(options.signMessageReject);
  } else {
    signMessage.mockResolvedValue(options?.signMessageResolve || "0xsignature");
  }

  const sendTransaction = vi.fn();
  if (options?.sendTransactionReject) {
    sendTransaction.mockRejectedValue(options.sendTransactionReject);
  } else {
    sendTransaction.mockResolvedValue(options?.sendTransactionResolve || "0xtxhash");
  }

  return {
    account: {
      address,
    },
    signMessage,
    signTransaction: vi.fn(),
    sendTransaction,
  } as any;
}

/**
 * Create a mock SVM signer with configurable behavior
 */
export function createMockSvmSigner(options?: {
  address?: string;
  signMessageResolve?: any;
  signMessageReject?: Error;
  sendTransactionResolve?: string;
  sendTransactionReject?: Error;
}): Signer {
  const address = options?.address || "11111111111111111111111111111111";

  const signMessage = vi.fn();
  if (options?.signMessageReject) {
    signMessage.mockRejectedValue(options.signMessageReject);
  } else {
    signMessage.mockResolvedValue(options?.signMessageResolve || "signature");
  }

  const sendTransaction = vi.fn();
  if (options?.sendTransactionReject) {
    sendTransaction.mockRejectedValue(options.sendTransactionReject);
  } else {
    sendTransaction.mockResolvedValue(options?.sendTransactionResolve || "txhash");
  }

  return {
    address,
    publicKey: address,
    signMessage,
    signTransaction: vi.fn(),
    sendTransaction,
  } as any;
}
