/**
 * Mock Signers
 *
 * Mock implementations of EVM signers for testing
 */

import type { Signer } from "x402/types";
import { vi } from "vitest";

/**
 * Create a mock EVM signer with configurable behavior
 *
 * @param options
 * @param options.address
 * @param options.signMessageResolve
 * @param options.signMessageReject
 * @param options.sendTransactionResolve
 * @param options.sendTransactionReject
 * @param options.writeContractResolve
 * @param options.writeContractReject
 */
export function createMockEvmSigner(options?: {
  address?: string;
  signMessageResolve?: any;
  signMessageReject?: Error;
  sendTransactionResolve?: string;
  sendTransactionReject?: Error;
  writeContractResolve?: string;
  writeContractReject?: Error;
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

  const writeContract = vi.fn();
  if (options?.writeContractReject) {
    writeContract.mockRejectedValue(options.writeContractReject);
  } else {
    writeContract.mockResolvedValue(options?.writeContractResolve || "0xtxhash");
  }

  return {
    account: {
      address,
    },
    signMessage,
    signTransaction: vi.fn(),
    sendTransaction,
    walletClient: {
      writeContract,
    },
  } as any;
}
