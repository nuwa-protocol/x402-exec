/**
 * Serverless x402x Payment Hook
 *
 * Simplified payment hook using @x402x/client SDK for direct facilitator interaction.
 * This replaces the manual 402 flow with a clean, type-safe API.
 */

import { useState } from "react";
import { usex402xClient, type ExecuteParams, type ExecuteResult } from "@x402x/client";
import { useNetworkSwitch } from "./useNetworkSwitch";
import type { Network } from "../config";
import { getFacilitatorUrl } from "../config";

export type ExecuteStatus =
  | "idle"
  | "preparing"
  | "signing"
  | "submitting"
  | "confirming"
  | "success"
  | "error";

export interface UseX402ExecuteReturn {
  execute: (params: ExecuteParams, network: Network) => Promise<ExecuteResult>;
  status: ExecuteStatus;
  error: string | null;
  result: ExecuteResult | null;
  reset: () => void;
  isExecuting: boolean;
}

/**
 * Hook for executing x402x settlements in Serverless Mode
 *
 * @example
 * ```tsx
 * const { execute, status, error, result } = useX402Execute();
 *
 * const handlePay = async () => {
 *   // Simple transfer (hook and hookData are optional)
 *   await execute({
 *     amount: '1000000',
 *     payTo: '0x...'
 *   }, 'base-sepolia');
 * };
 * ```
 */
export function useX402Execute(): UseX402ExecuteReturn {
  const [status, setStatus] = useState<ExecuteStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  const { switchToNetwork } = useNetworkSwitch();
  const facilitatorUrl = getFacilitatorUrl();
  const client = usex402xClient({ facilitatorUrl });

  const execute = async (params: ExecuteParams, network: Network): Promise<ExecuteResult> => {
    setStatus("preparing");
    setError(null);
    setResult(null);

    try {
      // Step 1: Switch to target network
      console.log("[x402x] Switching to network:", network);
      const switched = await switchToNetwork(network);
      if (!switched) {
        throw new Error(`Failed to switch to ${network}. Please switch manually and try again.`);
      }

      // Step 2: Ensure client is available
      if (!client) {
        throw new Error("X402 client not available. Please connect your wallet.");
      }

      console.log("[x402x] Executing settlement with params:", params);

      // Step 3: Execute settlement (SDK handles address normalization automatically)
      setStatus("signing");
      const executeResult = await client.execute(params, false); // waitForConfirmation = false - don't wait for on-chain confirmation, show facilitator result immediately

      console.log("[x402x] Settlement successful:", executeResult);

      setStatus("success");
      setResult(executeResult);

      return executeResult;
    } catch (err: any) {
      console.error("[x402x] Settlement error:", err);
      const errorMessage = err.message || "Settlement failed";
      setError(errorMessage);
      setStatus("error");
      throw err;
    }
  };

  const reset = () => {
    setStatus("idle");
    setError(null);
    setResult(null);
  };

  return {
    execute,
    status,
    error,
    result,
    reset,
    isExecuting: ["preparing", "signing", "submitting", "confirming"].includes(status),
  };
}
