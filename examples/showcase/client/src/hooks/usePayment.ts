/**
 * Payment processing hook
 * Handles x402 payment flow with commitment-based security
 *
 * This implementation manually constructs the payment flow to use
 * commitment hash as the EIP-3009 nonce, ensuring all settlement
 * parameters are cryptographically bound to the user's signature.
 */

import { useState, useEffect } from "react";
import { useAccount, useConnectorClient } from "wagmi";
import { createWalletClient, custom } from "viem";
import { signTypedData } from "viem/actions";
import { type Hex, type WalletClient } from "viem";
import { calculateCommitment, validateCommitmentParams } from "../utils/commitment";
import { buildApiUrl, Network } from "../config";
import { useNetworkSwitch } from "./useNetworkSwitch";

export type PaymentStatus =
  | "idle"
  | "preparing"
  | "paying"
  | "signing"
  | "submitting"
  | "success"
  | "error";

interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: {
    name?: string;
    version?: string;
    settlementRouter?: string;
    salt?: string;
    payTo?: string;
    facilitatorFee?: string;
    hook?: string;
    hookData?: string;
    [key: string]: any;
  };
}

interface PaymentResponse {
  accepts?: PaymentRequirements[];
  error?: string;
  x402Version?: number;
  extensions?: Record<string, any>; // Add extensions field for v2
}

export interface DebugInfo {
  paymentRequirements?: any;
  commitmentParams?: any;
  calculatedNonce?: string;
  authorizationParams?: any;
}

export function usePayment() {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});

  // CRITICAL FIX: Use useConnectorClient with fallback to manual creation
  const { address, isConnected, connector, chain } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const { switchToNetwork, isSwitching } = useNetworkSwitch();

  // State for manually created wallet client (fallback for non-standard wallets)
  const [manualWalletClient, setManualWalletClient] = useState<WalletClient | null>(null);

  // Fallback: Manually create wallet client if useConnectorClient fails
  useEffect(() => {
    const createManualClient = async () => {
      if (!connectorClient && connector && isConnected && address && chain) {
        try {
          console.log("[Payment] useConnectorClient failed, trying manual creation...");

          // Check if connector has getProvider method before calling it
          if (typeof connector.getProvider === "function") {
            const provider = await connector.getProvider();

            if (provider && typeof provider === "object") {
              const client = createWalletClient({
                account: address,
                chain: chain,
                transport: custom(provider as any), // Use 'as any' for non-standard wallet providers
              });

              console.log("[Payment] Manual wallet client created successfully");
              setManualWalletClient(client);
            } else {
              console.error("[Payment] Failed to get provider from connector");
              setManualWalletClient(null);
            }
          } else {
            console.log(
              "[Payment] Connector does not have getProvider method, skipping manual client creation",
            );
            setManualWalletClient(null);
          }
        } catch (err) {
          console.error("[Payment] Failed to create manual wallet client:", err);
          setManualWalletClient(null);
        }
      } else if (connectorClient) {
        // If connectorClient is available, clear manual client
        setManualWalletClient(null);
      }
    };

    createManualClient();
  }, [connectorClient, connector, isConnected, address, chain]);

  // Use connectorClient if available, otherwise use manual client
  const walletClient = (connectorClient || manualWalletClient) as WalletClient | undefined;

  const pay = async (endpoint: string, network: Network, body?: any) => {
    // Wallet connection validation - these checks are now handled by PaymentDialog
    // but we keep them here as a safety net
    if (!isConnected || !address) {
      const errorMsg = "Wallet not connected. Please connect your wallet and try again.";
      console.error("[Payment] Wallet validation failed:", {
        isConnected,
        address: !!address,
        connector: connector?.name,
      });

      setError(errorMsg);
      setStatus("error");
      throw new Error(errorMsg);
    }

    if (!walletClient) {
      const errorMsg = `Unable to create wallet client for ${connector?.name || "current wallet"}. This may be due to wallet compatibility issues. Please try disconnecting and reconnecting your wallet, or try a different wallet.`;
      console.error("[Payment] Wallet client not available:", {
        hasConnectorClient: !!connectorClient,
        hasManualClient: !!manualWalletClient,
        connector: connector?.name,
        connectorId: connector?.id,
        hasGetProvider: connector && typeof connector.getProvider === "function",
      });

      setError(errorMsg);
      setStatus("error");
      throw new Error(errorMsg);
    }

    console.log("[Payment] Wallet client validated:", {
      source: connectorClient ? "useConnectorClient" : "manual",
      hasWalletClient: !!walletClient,
      hasAccount: !!walletClient.account,
      address: walletClient.account?.address,
      chain: walletClient.chain?.id,
      connector: connector?.name,
    });

    // Switch to target network before payment
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
      // Build full API URL
      const fullUrl = buildApiUrl(endpoint);
      console.log("[Payment] Step 1: Initial request to", fullUrl);

      // Step 1: Make initial request to get 402 response (include network in body)
      const requestBody = { ...body, network };
      const initialResponse = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // If not 402, return the response directly
      if (initialResponse.status !== 402) {
        if (!initialResponse.ok) {
          const errorData = await initialResponse.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(
            errorData.error || `Request failed with status ${initialResponse.status}`,
          );
        }
        const data = await initialResponse.json();
        setResult(data);
        setStatus("success");
        return data;
      }

      // Step 2: Parse 402 response to get payment requirements
      const paymentResponse: PaymentResponse = await initialResponse.json();
      console.log("[Payment] Step 2: Received 402 response", paymentResponse);

      if (!paymentResponse.accepts || paymentResponse.accepts.length === 0) {
        throw new Error("No payment requirements provided");
      }

      // Find the payment requirements that match the selected network
      const paymentReq = paymentResponse.accepts.find((req) => req.network === network);
      if (!paymentReq) {
        throw new Error(
          `No payment requirements found for network: ${network}. Available networks: ${paymentResponse.accepts.map((r) => r.network).join(", ")}`,
        );
      }
      console.log("[Payment] Selected payment requirements for network:", network);

      const x402Version = paymentResponse.x402Version || 1;

      // Store payment requirements for debugging
      setDebugInfo((prev) => ({ ...prev, paymentRequirements: paymentReq }));

      // Step 3: Extract settlement parameters
      // NEW v2 standard: ALL settlement params from extensions
      // Fallback: v1/old format reads from extra
      
      // Extract EIP-712 domain parameters from extra (scheme-specific)
      const { name, version } = paymentReq.extra || {};
      
      // Extract ALL settlement parameters from extensions (if v2 with x402x extension)
      let settlementParams: {
        salt?: string;
        settlementRouter?: string;
        hook?: string;
        hookData?: string;
        finalPayTo?: string;
        facilitatorFee?: string;
      } = {};

      if (x402Version === 2 && paymentResponse.extensions?.["x402x-router-settlement"]?.info) {
        const extensionInfo = paymentResponse.extensions["x402x-router-settlement"].info;
        settlementParams = {
          salt: extensionInfo.salt,
          settlementRouter: extensionInfo.settlementRouter,
          hook: extensionInfo.hook,
          hookData: extensionInfo.hookData,
          finalPayTo: extensionInfo.finalPayTo,
          facilitatorFee: extensionInfo.facilitatorFee || "0",
        };
        console.log("[Payment] Step 3: Extracted settlement params from x402x extension (v2 standard):", settlementParams);
      } else {
        // Fallback for v1 or old format: read from extra
        const {
          settlementRouter,
          salt,
          payTo: finalPayTo,
          facilitatorFee,
          hook,
          hookData,
        } = paymentReq.extra || {};
        
        settlementParams = {
          salt,
          settlementRouter,
          hook,
          hookData,
          finalPayTo,
          facilitatorFee: facilitatorFee || "0",
        };
        console.log("[Payment] Step 3: Using fallback - extracted params from extra (v1 compat):", settlementParams);
      }

      // Destructure for use
      const { salt, settlementRouter, hook, hookData, finalPayTo, facilitatorFee } = settlementParams;

      // Check if this is a complex settlement (with router/hook) or simple direct payment
      const isComplexSettlement = !!settlementRouter;

      if (isComplexSettlement && (!salt || !finalPayTo || !hook || !hookData)) {
        console.error("[Payment] Missing settlement parameters:", {
          hasSalt: !!salt,
          hasFinalPayTo: !!finalPayTo,
          hasHook: !!hook,
          hasHookData: !!hookData,
          extensionInfo: paymentResponse.extensions?.["x402x-router-settlement"]?.info,
          extra: paymentReq.extra,
        });
        throw new Error("Missing required settlement parameters in payment requirements");
      }

      console.log("[Payment] Step 3: Settlement parameters", {
        isComplexSettlement,
        settlementRouter,
        salt,
        finalPayTo,
        facilitatorFee,
        hook,
      });

      setStatus("preparing");

      // Step 4: Prepare EIP-3009 authorization parameters
      const chainId = walletClient.chain?.id;
      const from = walletClient.account?.address;

      if (!chainId) {
        throw new Error(
          "Chain ID not available. Please ensure your wallet is connected to Base Sepolia network.",
        );
      }

      if (!from) {
        throw new Error("No account address available");
      }

      const value = paymentReq.maxAmountRequired;
      const validAfter = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes before
      const validBefore = (Math.floor(Date.now() / 1000) + paymentReq.maxTimeoutSeconds).toString();

      const authParams = {
        chainId,
        from,
        value,
        validAfter,
        validBefore,
      };
      console.log("[Payment] Step 4: Authorization parameters", authParams);

      // Store authorization parameters for debugging
      setDebugInfo((prev) => ({ ...prev, authorizationParams: authParams }));

      // Step 5: Calculate nonce
      // Two modes: commitment-based (for complex settlement) or random (for simple payment)
      let nonce: Hex;

      if (isComplexSettlement) {
        // Complex settlement: Calculate commitment hash (this becomes the nonce)
        const commitmentParams = {
          chainId,
          hub: settlementRouter!,
          asset: paymentReq.asset,
          from,
          value,
          validAfter,
          validBefore,
          salt: salt!,
          payTo: finalPayTo!,
          facilitatorFee: facilitatorFee || "0",
          hook: hook!,
          hookData: hookData!,
        };

        // Validate parameters before calculating commitment
        validateCommitmentParams(commitmentParams);

        nonce = calculateCommitment(commitmentParams) as Hex;

        console.log("[Payment] Step 5: Calculated commitment-based nonce", nonce);

        // Store commitment params and calculated nonce for debugging
        setDebugInfo((prev) => ({
          ...prev,
          commitmentParams,
          calculatedNonce: nonce,
        }));
      } else {
        // Simple direct payment: Generate random nonce
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        nonce = `0x${Array.from(randomBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}` as Hex;

        console.log("[Payment] Step 5: Generated random nonce", nonce);

        // Store nonce for debugging
        setDebugInfo((prev) => ({
          ...prev,
          calculatedNonce: nonce,
          nonceType: "random",
        }));
      }

      setStatus("signing");

      // Step 6: Sign EIP-712 authorization (EIP-3009)
      const domain = {
        name: name || "USDC",
        version: version || "2",
        chainId,
        verifyingContract: paymentReq.asset as Hex,
      };

      const types = {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      };

      const message = {
        from,
        to: (isComplexSettlement ? settlementRouter : paymentReq.payTo) as Hex,
        value: BigInt(value),
        validAfter: BigInt(validAfter),
        validBefore: BigInt(validBefore),
        nonce,
      };

      console.log("[Payment] Step 6: Signing EIP-712 message", { domain, message });

      // Use viem's signTypedData function instead of method call
      // This works with both standard and manually-created wallet clients
      const signature = await signTypedData(walletClient, {
        account: walletClient.account!,
        domain,
        types,
        primaryType: "TransferWithAuthorization",
        message,
      });

      console.log("[Payment] Signature obtained", signature);

      setStatus("submitting");

      // Step 7: Construct payment payload
      // IMPORTANT: Include the original paymentRequirements in the payload
      // This ensures the server uses the SAME salt and parameters
      const paymentPayload = {
        x402Version,
        scheme: paymentReq.scheme,
        network: paymentReq.network,
        payload: {
          signature,
          authorization: {
            from,
            to: isComplexSettlement ? settlementRouter : paymentReq.payTo,
            value,
            validAfter,
            validBefore,
            nonce,
          },
        },
        paymentRequirements: paymentReq, // Include original requirements
      };

      // Step 8: Encode payment header (base64url)
      const paymentJson = JSON.stringify(paymentPayload);
      const paymentBase64 = btoa(paymentJson)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      console.log(
        "[Payment] Step 8: Encoded payment header (first 100 chars)",
        paymentBase64.substring(0, 100),
      );

      // Step 9: Resend request with X-PAYMENT header (include network in body)
      const finalResponse = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT": paymentBase64,
        },
        body: JSON.stringify(requestBody),
      });

      console.log("[Payment] Step 9: Final response status", finalResponse.status);

      if (!finalResponse.ok) {
        const errorData = await finalResponse.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Payment failed with status ${finalResponse.status}`);
      }

      const data = await finalResponse.json();
      console.log("[Payment] Payment successful", data);

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

  const reset = () => {
    setStatus("idle");
    setError("");
    setResult(null);
    setDebugInfo({});
  };

  return {
    status,
    error,
    result,
    debugInfo,
    pay,
    reset,
    isSwitching,
  };
}
