/**
 * @x402x/client - Client SDK for x402x Serverless Mode
 *
 * This package provides a simple, type-safe SDK for executing on-chain contracts
 * directly via facilitator without needing a resource server.
 *
 * @example High-level API
 * ```typescript
 * import { X402Client } from '@x402x/client';
 * import { TransferHook } from '@x402x/core';
 *
 * const client = new X402Client({
 *   wallet: walletClient,
 *   network: 'base-sepolia',
 *   facilitatorUrl: 'https://facilitator.x402x.dev'
 * });
 *
 * const result = await client.execute({
 *   hook: TransferHook.getAddress('base-sepolia'),
 *   hookData: TransferHook.encode(),
 *   amount: '1000000',
 *   recipient: '0x...'
 * });
 * ```
 *
 * @example Low-level API
 * ```typescript
 * import {
 *   prepareSettlement,
 *   signAuthorization,
 *   submitToFacilitator
 * } from '@x402x/client';
 *
 * const settlement = await prepareSettlement({...});
 * const signed = await signAuthorization(wallet, settlement);
 * const result = await submitToFacilitator(facilitatorUrl, signed);
 * ```
 *
 * @example React Hooks
 * ```typescript
 * import { useX402Client, useExecute } from '@x402x/client';
 *
 * const client = useX402Client({
 *   facilitatorUrl: 'https://facilitator.x402x.dev'
 * });
 *
 * const { execute, status, error } = useExecute();
 * await execute({ hook: '0x...', amount: '1000000', ... });
 * ```
 *
 * @module @x402x/client
 */

// Export main client class and constants
export { X402Client, DEFAULT_FACILITATOR_URL } from "./client.js";

// Export low-level API
export { prepareSettlement, queryFacilitatorFee } from "./core/prepare.js";
export { signAuthorization } from "./core/sign.js";
export { submitToFacilitator } from "./core/submit.js";

// Export utilities
export { generateSalt, calculateTimeWindow, formatFacilitatorUrl } from "./core/utils.js";

// Export React hooks (optional, requires React peer dependency)
export { useX402Client } from "./hooks/useX402Client.js";
export { useExecute } from "./hooks/useExecute.js";

// Export types
export type {
  X402ClientConfig,
  ExecuteParams,
  ExecuteResult,
  SettlementData,
  PrepareParams,
  SignedAuthorization,
  SubmitResult,
  FeeEstimate,
  ExecuteStatus,
  PaymentPayload,
  PaymentRequirements,
} from "./types.js";

// Export errors
export {
  X402ClientError,
  NetworkError,
  SigningError,
  FacilitatorError,
  TransactionError,
  ValidationError,
} from "./errors.js";
