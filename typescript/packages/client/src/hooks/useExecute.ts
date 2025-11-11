/**
 * React hook for executing settlements
 *
 * This hook provides a simple interface for executing settlements with
 * automatic state management (status, error, result).
 */

import { useState, useCallback } from "react";
import { useX402Client, type UseX402ClientConfig } from "./useX402Client.js";
import type { ExecuteParams, ExecuteResult, ExecuteStatus } from "../types.js";

/**
 * Return type for useExecute hook
 */
export interface UseExecuteReturn {
  /** Execute a settlement */
  execute: (params: ExecuteParams, waitForConfirmation?: boolean) => Promise<ExecuteResult>;
  /** Current execution status */
  status: ExecuteStatus;
  /** Error if execution failed */
  error: Error | null;
  /** Result if execution succeeded */
  result: ExecuteResult | null;
  /** Reset state */
  reset: () => void;
  /** Whether currently executing */
  isExecuting: boolean;
  /** Whether execution succeeded */
  isSuccess: boolean;
  /** Whether execution failed */
  isError: boolean;
}

/**
 * React hook for executing settlements
 *
 * Provides a simple interface for executing settlements with automatic
 * state management. Automatically uses the connected wallet from wagmi.
 *
 * @param config - Optional client configuration (if not using global client)
 * @returns Execute function and state
 *
 * @example
 * ```typescript
 * import { useExecute } from '@x402x/client';
 * import { TransferHook } from '@x402x/core';
 *
 * function PayButton() {
 *   const { execute, status, error, result } = useExecute({
 *     facilitatorUrl: 'https://facilitator.x402x.dev'
 *   });
 *
 *   const handlePay = async () => {
 *     try {
 *       const result = await execute({
 *         hook: TransferHook.getAddress('base-sepolia'),
 *         hookData: TransferHook.encode(),
 *         amount: '1000000',
 *         recipient: '0x...'
 *       });
 *       console.log('Success:', result.txHash);
 *     } catch (err) {
 *       console.error('Failed:', err);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handlePay} disabled={status !== 'idle'}>
 *         {status === 'idle' ? 'Pay' : 'Processing...'}
 *       </button>
 *       {status === 'success' && <div>✅ Success! TX: {result.txHash}</div>}
 *       {status === 'error' && <div>❌ Error: {error.message}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useExecute(config?: UseX402ClientConfig): UseExecuteReturn {
  const client = useX402Client(config);
  const [status, setStatus] = useState<ExecuteStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  const execute = useCallback(
    async (params: ExecuteParams, waitForConfirmation: boolean = true): Promise<ExecuteResult> => {
      if (!client) {
        throw new Error("X402Client not available. Please connect your wallet.");
      }

      setStatus("preparing");
      setError(null);
      setResult(null);

      try {
        const executeResult = await client.execute(params, waitForConfirmation);
        setStatus("success");
        setResult(executeResult);
        return executeResult;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setStatus("error");
        setError(error);
        throw error;
      }
    },
    [client],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
  }, []);

  return {
    execute,
    status,
    error,
    result,
    reset,
    isExecuting: ["preparing", "signing", "submitting", "confirming"].includes(status),
    isSuccess: status === "success",
    isError: status === "error",
  };
}

/**
 * Alternative hook that doesn't require config (uses default client from context)
 *
 * @example
 * ```typescript
 * import { useExecute } from '@x402x/client';
 *
 * function PayButton({ facilitatorUrl }: { facilitatorUrl: string }) {
 *   const { execute, status, error } = useExecute({ facilitatorUrl });
 *
 *   const handlePay = async () => {
 *     await execute({
 *       hook: '0x...',
 *       hookData: '0x...',
 *       amount: '1000000',
 *       recipient: '0x...'
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handlePay} disabled={status !== 'idle'}>
 *       Pay
 *     </button>
 *   );
 * }
 * ```
 */
export function useExecuteWithClient(
  client: ReturnType<typeof useX402Client>,
): Omit<UseExecuteReturn, "reset"> {
  const [status, setStatus] = useState<ExecuteStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  const execute = useCallback(
    async (params: ExecuteParams, waitForConfirmation: boolean = true): Promise<ExecuteResult> => {
      if (!client) {
        throw new Error("X402Client not available. Please connect your wallet.");
      }

      setStatus("preparing");
      setError(null);
      setResult(null);

      try {
        const executeResult = await client.execute(params, waitForConfirmation);
        setStatus("success");
        setResult(executeResult);
        return executeResult;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setStatus("error");
        setError(error);
        throw error;
      }
    },
    [client],
  );

  return {
    execute,
    status,
    error,
    result,
    isExecuting: ["preparing", "signing", "submitting", "confirming"].includes(status),
    isSuccess: status === "success",
    isError: status === "error",
  };
}
