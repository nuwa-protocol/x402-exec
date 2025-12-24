/**
 * React hook for creating X402Client instance
 *
 * This hook automatically creates an X402Client instance using wagmi's
 * wallet client and chain information.
 */

import { useMemo } from "react";
import { useWalletClient, useAccount, useChainId, WagmiProviderNotFoundError } from "wagmi";
import { publicActions } from "viem";
import { X402Client } from "../client.js";
import type { X402ClientConfig } from "../types.js";

/**
 * Partial configuration for useX402Client hook
 * (wallet, network, chainId are auto-detected from wagmi)
 */
export type UseX402ClientConfig = Partial<Omit<X402ClientConfig, "wallet" | "network">> & {
  /** Optional: Facilitator URL (default: https://facilitator.x402x.dev/) */
  facilitatorUrl?: string;
  /** Optional: Override network name (auto-detected from chain if not provided) */
  network?: string;
};

/**
 * Map chainId to network name
 */
const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  84532: "base-sepolia",
  8453: "base",
  196: "x-layer",
  1952: "x-layer-testnet",
  97: "bsc-testnet",
  56: "bsc",
};

/**
 * React hook for X402Client
 *
 * Automatically creates an X402Client instance using the connected wallet
 * from wagmi. Returns null if wallet is not connected.
 *
 * @param config - Client configuration (facilitatorUrl is optional, defaults to https://facilitator.x402x.dev/)
 * @returns X402Client instance or null if wallet not connected
 *
 * @example
 * ```typescript
 * import { useX402Client } from '@x402x/client';
 *
 * function MyComponent() {
 *   // Use default facilitator
 *   const client = useX402Client();
 *
 *   // Or specify custom facilitator
 *   const client = useX402Client({
 *     facilitatorUrl: 'https://custom-facilitator.example.com'
 *   });
 *
 *   if (!client) {
 *     return <div>Please connect your wallet</div>;
 *   }
 *
 *   const handlePay = async () => {
 *     const result = await client.execute({
 *       hook: '0x...',
 *       hookData: '0x...',
 *       amount: '1000000',
 *       payTo: '0x...'
 *     });
 *   };
 *
 *   return <button onClick={handlePay}>Pay</button>;
 * }
 * ```
 */
export function useX402Client(config?: UseX402ClientConfig): X402Client | null {
  // First, try to get wagmi hooks outside of useMemo to catch provider errors early
  let walletClient: any;
  let isConnected: boolean;
  let chainId: number;

  try {
    const walletClientResult = useWalletClient();
    const accountResult = useAccount();
    const chainIdResult = useChainId();

    walletClient = walletClientResult.data;
    isConnected = accountResult.isConnected;
    chainId = chainIdResult;
  } catch (error) {
    // If wagmi provider context is missing (e.g., during early render), return null quietly
    if (
      error instanceof WagmiProviderNotFoundError ||
      (error as any)?.name === "WagmiProviderNotFoundError" ||
      (error instanceof Error &&
        error.message.includes("useConfig") &&
        error.message.includes("WagmiProvider"))
    ) {
      return null;
    }

    console.warn("[x402x] Unable to access wagmi provider:", error);
    return null;
  }

  return useMemo(() => {
    if (!isConnected || !walletClient) {
      return null;
    }

    // Determine network name
    const network = config?.network || CHAIN_ID_TO_NETWORK[chainId];
    if (!network) {
      console.warn(
        `[x402x] Unknown chainId ${chainId}. Please provide network name explicitly in config.`,
      );
      return null;
    }

    try {
      // Extend wallet client with public actions (required for waitForTransactionReceipt)
      const extendedWallet = walletClient.extend(publicActions);

      return new X402Client({
        wallet: extendedWallet,
        network,
        facilitatorUrl: config?.facilitatorUrl,
        networkConfig: config?.networkConfig,
        timeout: config?.timeout,
        confirmationTimeout: config?.confirmationTimeout,
      });
    } catch (error) {
      console.error("[x402x] Failed to create X402Client:", error);
      return null;
    }
  }, [
    isConnected,
    walletClient,
    chainId,
    config?.network,
    config?.facilitatorUrl,
    config?.networkConfig,
    config?.timeout,
    config?.confirmationTimeout,
  ]);
}
