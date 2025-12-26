/**
 * Payment processing hook using official x402 SDK with x402x extension
 * 
 * This implementation uses the official @x402/core client with
 * ExactEvmSchemeWithRouterSettlement for x402x router settlement support.
 */

import { useState, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { registerX402xScheme } from "@x402x/extensions";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { buildApiUrl, type Network } from "../config";
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
 * Simple hook for x402x payments using official SDK
 * 
 * This provides a cleaner implementation by delegating the complex
 * payment logic to the official x402 SDK and our custom scheme.
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
   * @param network - Network identifier (e.g., "base-sepolia")
   * @param body - Request body
   * @returns Payment result
   */
  const pay = async (endpoint: string, network: Network, body?: any) => {
    if (!isConnected || !address || !walletClient) {
      const errorMsg = "Wallet not connected. Please connect your wallet and try again.";
      setError(errorMsg);
      setStatus("error");
      throw new Error(errorMsg);
    }

    // Switch to target network
    console.log("[Payment] Switching to network:", network);
    const switched = await switchToNetwork(network);
    if (!switched) {
      const errorMsg = `Failed to switch to ${network}. Please switch manually and try again.`;
      setError(errorMsg);
      setStatus("error");
      throw new Error(errorMsg);
    }

    setStatus("preparing");
    setError("");
    setResult(null);

    try {
      const fullUrl = buildApiUrl(endpoint);
      const requestBody = { ...body, network };

      console.log("[Payment] Setting up x402Client with x402x router settlement");

      // Create signer for the scheme
      const signer = {
        address: walletClient.account!.address,
        signTypedData: async (params: any) => {
          return await walletClient.signTypedData(params);
        },
      };

      // One-line setup for x402x! 🎉
      const v2NetworkId = `eip155:${walletClient.chain!.id}` as `${string}:${string}`;
      const client = new x402Client();
      registerX402xScheme(client, v2NetworkId, signer);

      // Debug: print the exact accepted requirements that will be embedded in PAYMENT-SIGNATURE (v2 matching is deepEqual)
      client.onAfterPaymentCreation(async ({ paymentPayload }) => {
        console.log("[Payment] paymentPayload.accepted:", paymentPayload.accepted);
      });

      // Wrap fetch with automatic 402 payment handling
      // Add debug wrapper to see what's happening
      const fetchWithDebug = async (input: URL | RequestInfo, init?: RequestInit) => {
        console.log("[Payment] Making fetch request to:", input);
        console.log("[Payment] Request headers:", init?.headers);

        // Workaround: upstream @x402/fetch incorrectly adds Access-Control-Expose-Headers as a REQUEST header.
        // That causes browser preflight failures unless the server whitelists it.
        // Strip it client-side so we don't need server-side CORS hacks.
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

      // Make the request - the wrapper will automatically:
      // 1. Detect 402 response
      // 2. Parse payment requirements from headers
      // 3. Call our scheme to create payment payload
      // 4. Retry request with PAYMENT-SIGNATURE header
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

            // Some proxies/frameworks may return raw JSON (not base64). Handle both.
            if (trimmed.startsWith("{")) {
              return JSON.parse(trimmed) as { error?: string };
            }

            // PAYMENT-REQUIRED is base64-encoded JSON (may be base64url and/or missing padding).
            const base64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
            const padLen = (4 - (base64.length % 4)) % 4;
            const padded = base64 + "=".repeat(padLen);

            // atob returns a binary string; decode as UTF-8 to support non-ascii JSON.
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

          // Parsed successfully: surface server-provided reason (if any)
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

