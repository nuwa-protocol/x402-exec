/**
 * Payment processing hook using official x402 SDK with x402x extension
 * 
 * This implementation uses the official @x402/core client with
 * ExactEvmSchemeWithRouterSettlement for x402x router settlement support.
 * 
 * V2 Negotiation: Uses paymentRequirementsSelector to match UI-selected network/option.
 * Network Mapping: Uses x402x getNetworkConfig for CAIP-2 → chainId conversion.
 */

import { useState, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { registerX402xScheme, getNetworkConfig } from "@x402x/extensions";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { buildApiUrl, getNetworkByChainId } from "../config";
import { useNetworkSwitch } from "./useNetworkSwitch";

export type PaymentStatus =
  | "idle"
  | "preparing"
  | "paying"
  | "signing"
  | "submitting"
  | "success"
  | "error";

/**
 * Hook for x402x payments using official SDK with v2 negotiation
 * 
 * This provides a payment flow that:
 * 1. Accepts a preferred network from UI
 * 2. Uses paymentRequirementsSelector to pick the matching accept option
 * 3. Switches to the correct network if needed
 * 4. Delegates payment to the official x402 SDK
 */
export function usePaymentV2() {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchToNetwork } = useNetworkSwitch();

  /**
   * Make a payment using the x402x scheme with official SDK
   * 
   * @param endpoint - API endpoint (e.g., "/api/purchase-download")
   * @param preferredNetwork - Preferred network (CAIP-2 format, e.g., "eip155:84532")
   * @param body - Request body
   * @returns Payment result
   */
  const pay = async (endpoint: string, preferredNetwork: string, body?: any) => {
    if (!isConnected || !address || !walletClient) {
      const errorMsg = "Wallet not connected. Please connect your wallet and try again.";
      setError(errorMsg);
      setStatus("error");
      throw new Error(errorMsg);
    }

    // Extract chainId from CAIP-2 and switch network
    const chainIdStr = preferredNetwork.split(":")[1];
    if (!chainIdStr) {
      const errorMsg = "Invalid network format";
      setError(errorMsg);
      setStatus("error");
      throw new Error(errorMsg);
    }

    const targetChainId = parseInt(chainIdStr, 10);
    console.log("[Payment] Target chainId:", targetChainId, "current:", walletClient.chain?.id);

    // Switch to target network if needed
    if (walletClient.chain?.id !== targetChainId) {
      console.log("[Payment] Switching to chainId:", targetChainId);
      
      // Use local config to map chainId to v1 network name for switchToNetwork
      // (switchToNetwork still expects v1 network names, but we derive it from chainId)
      const networkV1 = getNetworkByChainId(targetChainId);
      if (!networkV1) {
        // Verify network exists in x402x config before failing
        const x402xConfig = getNetworkConfig(preferredNetwork);
        if (!x402xConfig) {
          const errorMsg = `Network ${preferredNetwork} not supported by x402x`;
          setError(errorMsg);
          setStatus("error");
          throw new Error(errorMsg);
        }
        
        const errorMsg = `ChainId ${targetChainId} not configured in local wallet switch mapping. Please add it to config.ts`;
        setError(errorMsg);
        setStatus("error");
        throw new Error(errorMsg);
      }

      const switched = await switchToNetwork(networkV1 as any);
      if (!switched) {
        const errorMsg = `Failed to switch to network ${networkV1} (chainId ${targetChainId}). Please switch manually and try again.`;
        setError(errorMsg);
        setStatus("error");
        throw new Error(errorMsg);
      }
    }

    setStatus("preparing");
    setError("");
    setResult(null);

    try {
      const fullUrl = buildApiUrl(endpoint);
      const requestBody = { ...body, network: preferredNetwork };

      console.log("[Payment] Setting up x402Client with x402x router settlement");

      // Create signer for the scheme
      const signer = {
        address: walletClient.account!.address,
        signTypedData: async (params: any) => {
          return await walletClient.signTypedData(params);
        },
      };

      // Setup x402 client with custom selector
      const v2NetworkId = preferredNetwork as `${string}:${string}`;
      const client = new x402Client((_x402Version, accepts) => {
        // Custom selector: prefer the network that matches UI selection
        console.log("[Payment] Selector called with", accepts.length, "options");
        const match = accepts.find((a) => a.network === preferredNetwork);
        if (match) {
          console.log("[Payment] Matched accept option:", match.network);
          return match;
        }
        // Fallback to first option
        console.warn("[Payment] No exact match, using first option");
        return accepts[0];
      });

      registerX402xScheme(client, v2NetworkId, signer);

      // Debug: print the exact accepted requirements
      client.onAfterPaymentCreation(async ({ paymentPayload }) => {
        console.log("[Payment] paymentPayload.accepted:", paymentPayload.accepted);
        console.log("[Payment] paymentPayload.extensions:", paymentPayload.extensions);
      });

      // Wrap fetch with automatic 402 payment handling
      const fetchWithDebug = async (input: URL | RequestInfo, init?: RequestInit) => {
        console.log("[Payment] Making fetch request to:", input);

        // Workaround: upstream @x402/fetch incorrectly adds Access-Control-Expose-Headers as a REQUEST header.
        if (init?.headers) {
          const h = new Headers(init.headers);
          h.delete("Access-Control-Expose-Headers");
          h.delete("access-control-expose-headers");
          init = { ...init, headers: h };
        }

        const response = await fetch(input, init);
        console.log("[Payment] Response status:", response.status);
        
        if (response.status === 402) {
          console.log("[Payment] Got 402, inspecting headers:");
          response.headers.forEach((value, key) => {
            console.log(`  ${key}: ${value.substring(0, 150)}${value.length > 150 ? '...' : ''}`);
          });
        }
        
        return response;
      };
      
      const fetchWithPayment = wrapFetchWithPayment(fetchWithDebug, client);

      console.log("[Payment] Making request with automatic 402 handling to:", fullUrl);
      setStatus("signing");

      const response = await fetchWithPayment(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("[Payment] Response status:", response.status);

      // If payment still fails after automatic retry, parse v2 error from PAYMENT-REQUIRED header.
      if (response.status === 402) {
        const paymentRequiredHeader =
          response.headers.get("PAYMENT-REQUIRED") || response.headers.get("payment-required");
        if (paymentRequiredHeader) {
          const decodePaymentRequired = (raw: string) => {
            const trimmed = raw.trim();

            if (trimmed.startsWith("{")) {
              return JSON.parse(trimmed) as { error?: string };
            }

            const base64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
            const padLen = (4 - (base64.length % 4)) % 4;
            const padded = base64 + "=".repeat(padLen);

            const binary = atob(padded);
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            const decoded = new TextDecoder().decode(bytes);
            return JSON.parse(decoded) as { error?: string };
          };

          let parsed: { error?: string } | undefined;
          try {
            parsed = decodePaymentRequired(paymentRequiredHeader);
          } catch (e) {
            console.warn("[Payment] Failed to parse PAYMENT-REQUIRED header", {
              headerPrefix: paymentRequiredHeader.slice(0, 32),
              headerLength: paymentRequiredHeader.length,
              error: e instanceof Error ? e.message : String(e),
            });
            throw new Error("Payment required (failed to parse PAYMENT-REQUIRED header)");
          }

          throw new Error(parsed.error || "Payment required");
        }
        throw new Error("Payment required");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error || `Request failed with status ${response.status}`,
        );
      }

      const data = await response.json();
      console.log("[Payment] Payment successful:", data);

      setResult(data);
      setStatus("success");

      return data;
    } catch (err: any) {
      console.error("[Payment] Payment error:", err);
      setError(err.message || "Payment failed");
      setStatus("error");
      throw err;
    }
  };

  const reset = useCallback(() => {
    setStatus("idle");
    setError("");
    setResult(null);
  }, []);

  return {
    status,
    error,
    result,
    pay,
    reset,
  };
}
