/**
 * Serverless Payment Dialog Component
 * Complete payment flow: network selection → fee display → payment confirmation
 */

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { TransferHook, calculateFacilitatorFee, formatDefaultAssetAmount } from "@x402x/core";
import { useX402Client, X402Client } from "@x402x/client";
import type { FeeCalculationResult } from "@x402x/client";
import { useNetworkSwitch } from "../hooks/useNetworkSwitch";
import { WalletSelector } from "./WalletSelector";
import { publicActions } from "viem";
import {
  type Network,
  NETWORKS,
  getPreferredNetwork,
  setPreferredNetwork,
  getFacilitatorUrl,
} from "../config";

type PaymentStep = "select-network" | "switch-network" | "loading-fee" | "confirm-payment";

interface ServerlessPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string; // In atomic units (e.g., "100000" for 0.1 USDC)
  payTo: string; // Recipient address
  hook?: `0x${string}`; // Optional: custom hook address (defaults to TransferHook)
  hookData?: `0x${string}`; // Optional: custom hook data (defaults to empty TransferHook)
  prepareHookData?: (network: Network) => { hook: `0x${string}`; hookData: `0x${string}` }; // Optional: function to prepare hook/hookData per network
  onSuccess?: (result: { txHash: string; network: Network; facilitatorFee?: string }) => void;
  onError?: (error: string) => void;
}

export function ServerlessPaymentDialog({
  isOpen,
  onClose,
  amount,
  payTo: recipient,
  hook: customHook,
  hookData: customHookData,
  prepareHookData,
  onSuccess,
  onError,
}: ServerlessPaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>("select-network");
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [feeInfo, setFeeInfo] = useState<FeeCalculationResult | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isLoadingFee, setIsLoadingFee] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  const { address, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const facilitatorUrl = getFacilitatorUrl(); // Get facilitator URL from config
  
  // Fix: Pass selectedNetwork explicitly to useX402Client
  // This ensures the client is recreated whenever the user selects a different network,
  // guaranteeing that calculateFee() and execute() always use the correct network.
  const client = useX402Client({ 
    facilitatorUrl,
    network: selectedNetwork ?? undefined  // Explicitly use the selected network
  });
  
  const { switchToNetwork, isSwitching } = useNetworkSwitch();

  const handleResetNetworkSelection = () => {
    setSelectedNetwork(null);
    setFeeInfo(null);
    setError(null);
    setShowWalletSelector(false);
    setStep("select-network");
  };

  // Hide wallet selector once a wallet connects
  useEffect(() => {
    if (isConnected && showWalletSelector) {
      setShowWalletSelector(false);
    }
  }, [isConnected, showWalletSelector]);

  // Load preferred network on open
  useEffect(() => {
    if (isOpen) {
      const preferred = getPreferredNetwork();
      if (preferred) {
        setSelectedNetwork(preferred);
        setStep("select-network");
      } else {
        setSelectedNetwork(null);
        setStep("select-network");
      }
      setFeeInfo(null);
      setError(null);
      setIsPaying(false);
    }
  }, [isOpen]);

  // Helper function to load fee
  const loadFee = useCallback(
    async (network: Network) => {
      setIsLoadingFee(true);
      try {
        console.log("[ServerlessPaymentDialog] Loading fee for network:", network);

        // Determine hook and hookData based on priority:
        // 1. Use prepareHookData function if provided (network-specific)
        // 2. Use custom hook/hookData if provided (static)
        // 3. Default to TransferHook
        let hook: `0x${string}`;
        let hookData: `0x${string}`;

        if (prepareHookData) {
          // Use dynamic preparation function
          const prepared = prepareHookData(network);
          hook = prepared.hook;
          hookData = prepared.hookData;
          console.log(
            "[ServerlessPaymentDialog] Using prepareHookData for network:",
            network,
            "hook:",
            hook,
          );
        } else if (customHook) {
          // Use static custom hook
          hook = customHook;
          hookData = (customHookData || TransferHook.encode()) as `0x${string}`;
        } else {
          // Default to TransferHook
          hook = TransferHook.getAddress(network) as `0x${string}`;
          hookData = TransferHook.encode() as `0x${string}`;
        }

        // If wallet isn't connected yet, fall back to direct facilitator query.
        const fee = client
          ? await client.calculateFee(hook, hookData)
          : await calculateFacilitatorFee(facilitatorUrl, network, hook, hookData);

        console.log("[ServerlessPaymentDialog] Fee loaded:", fee);
        setFeeInfo(fee);
        setStep("confirm-payment");
      } catch (err: any) {
        console.error("[ServerlessPaymentDialog] Failed to load fee:", err);
        setError(err.message || "Failed to load facilitator fee");
        setStep("select-network");
      } finally {
        setIsLoadingFee(false);
      }
    },
    [address, client, customHook, customHookData, facilitatorUrl, prepareHookData],
  );

  // Load fee when network is selected
  const handleNetworkSelect = async (network: Network) => {
    setSelectedNetwork(network);
    setPreferredNetwork(network); // Remember user's choice
    setError(null);

    // Check if we need to switch network
    const targetChainId = NETWORKS[network].chainId;
    if (isConnected && chain?.id !== targetChainId) {
      setStep("switch-network");
    } else {
      // Already on correct network, load fee directly
      setStep("loading-fee");
      await loadFee(network);
    }
  };

  // Auto-switch network when entering switch-network step
  useEffect(() => {
    if (step === "switch-network" && selectedNetwork && isConnected) {
      const switchNetwork = async () => {
        const success = await switchToNetwork(selectedNetwork);
        if (success) {
          // Switch successful, load fee
          setStep("loading-fee");
          await loadFee(selectedNetwork);
        } else {
          // Switch failed, go back to selection
          setError(
            `Failed to switch to ${NETWORKS[selectedNetwork].displayName}. Please try again or select a different network.`,
          );
          setStep("select-network");
        }
      };
      switchNetwork();
    }
  }, [step, selectedNetwork, isConnected, switchToNetwork]);

  // Auto-continue flow after wallet connection
  useEffect(() => {
    if (
      isConnected &&
      selectedNetwork &&
      step === "select-network" &&
      !showWalletSelector &&
      client
    ) {
      // Wallet just connected and client is ready, continue with the selected network
      const targetChainId = NETWORKS[selectedNetwork].chainId;
      if (chain?.id !== targetChainId) {
        setStep("switch-network");
      } else {
        // Already on correct network, load fee directly
        setStep("loading-fee");
        loadFee(selectedNetwork);
      }
    }
  }, [isConnected, selectedNetwork, chain, step, showWalletSelector, client, loadFee]);

  // If we entered loading-fee while client/address were not ready, retry once they appear
  useEffect(() => {
    if (
      step === "loading-fee" &&
      selectedNetwork &&
      !feeInfo &&
      !isLoadingFee
    ) {
      void loadFee(selectedNetwork);
    }
  }, [step, selectedNetwork, feeInfo, isLoadingFee, loadFee]);

  // Handle payment
  const handlePay = async () => {
    if (!selectedNetwork || !feeInfo) {
      return;
    }

    // Require wallet connection at pay time
    if (!isConnected) {
      setShowWalletSelector(true);
      return;
    }

    // Build a client on the fly if the hook hasn't produced one yet
    let activeClient = client;
    if (!activeClient) {
      if (!walletClient) {
        setShowWalletSelector(true);
        return;
      }
      try {
        const extendedWallet = walletClient.extend(publicActions);
        activeClient = new X402Client({
          wallet: extendedWallet,
          network: selectedNetwork,
          facilitatorUrl,
        });
      } catch (err) {
        console.error("[ServerlessPaymentDialog] Failed to build client from wallet:", err);
        setError("Wallet client is not ready. Please try again in a moment.");
        return;
      }
    }

    setIsPaying(true);
    setError(null);

    try {
      // Determine hook and hookData using same logic as loadFee
      let hook: `0x${string}`;
      let hookData: `0x${string}`;

      if (prepareHookData) {
        const prepared = prepareHookData(selectedNetwork);
        hook = prepared.hook;
        hookData = prepared.hookData;
      } else if (customHook) {
        hook = customHook;
        hookData = (customHookData || TransferHook.encode()) as `0x${string}`;
      } else {
        hook = TransferHook.getAddress(selectedNetwork) as `0x${string}`;
        hookData = TransferHook.encode() as `0x${string}`;
      }

      const result = await activeClient.execute(
        {
          hook,
          hookData,
          amount,
          payTo: recipient as `0x${string}`,
          facilitatorFee: feeInfo.facilitatorFee,
        },
        false,
      ); // waitForConfirmation = false - don't wait for transaction confirmation, show facilitator result directly

      console.log("[ServerlessPaymentDialog] Execute result:", result);
      console.log("[ServerlessPaymentDialog] Selected network:", selectedNetwork);
      onSuccess?.({
        txHash: result.txHash,
        network: selectedNetwork,
        facilitatorFee: feeInfo.facilitatorFee, // Pass the actual facilitator fee
      });
      onClose();
    } catch (err: any) {
      console.error("Payment failed:", err);
      const errorMsg = err.message || "Payment failed";
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsPaying(false);
    }
  };

  if (!isOpen) return null;

  // Format amount for display using dynamic decimals
  const amountInUsd = selectedNetwork
    ? formatDefaultAssetAmount(amount, selectedNetwork)
    : (parseFloat(amount) / 1_000_000).toFixed(6); // Fallback for network not selected

  const totalAmount = feeInfo && selectedNetwork
    ? formatDefaultAssetAmount(
        (BigInt(amount) + BigInt(feeInfo.facilitatorFee)).toString(),
        selectedNetwork
      )
    : amountInUsd;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={!isPaying ? onClose : undefined}
      >
        {/* Dialog */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "30px",
            maxWidth: "500px",
            width: "90%",
            maxHeight: "80vh",
            overflow: "auto",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
            position: "relative",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          {!isPaying && (
            <button
              onClick={onClose}
              style={{
                position: "absolute",
                top: "15px",
                right: "15px",
                background: "none",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "#666",
                padding: "5px 10px",
                lineHeight: "1",
              }}
              title="Close"
            >
              ×
            </button>
          )}

          {/* Step 1: Network Selection */}
          {step === "select-network" && (
            <>
              <h2 style={{ marginTop: 0, marginBottom: "10px", color: "#333" }}>
                🌐 Select Payment Network
              </h2>
              <p style={{ marginBottom: "25px", color: "#666", fontSize: "14px" }}>
                {isConnected
                  ? `Choose the blockchain network for your $${amountInUsd} payment`
                  : `Choose a network to get started (wallet connection will be requested next)`}
              </p>

              {error && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "15px",
                    backgroundColor: "#fee",
                    borderRadius: "8px",
                    border: "1px solid #fcc",
                  }}
                >
                  <div style={{ fontSize: "14px", color: "#c00" }}>❌ {error}</div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Object.entries(NETWORKS).map(([key, networkConfig]) => (
                  <button
                    key={key}
                    onClick={() => handleNetworkSelect(key as Network)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "15px",
                      padding: "18px 20px",
                      border: selectedNetwork === key ? "2px solid #3b82f6" : "2px solid #e5e7eb",
                      borderRadius: "10px",
                      backgroundColor: selectedNetwork === key ? "#f0f9ff" : "white",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textAlign: "left",
                      fontSize: "16px",
                      fontWeight: "500",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#3b82f6";
                      e.currentTarget.style.backgroundColor = "#f0f9ff";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      if (selectedNetwork !== key) {
                        e.currentTarget.style.borderColor = "#e5e7eb";
                        e.currentTarget.style.backgroundColor = "white";
                      }
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <span style={{ fontSize: "32px" }}>{networkConfig.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", color: "#111", marginBottom: "2px" }}>
                        {networkConfig.displayName}
                      </div>
                      <div style={{ fontSize: "13px", color: "#6b7280" }}>{networkConfig.name}</div>
                    </div>
                    <span style={{ color: "#3b82f6", fontSize: "20px" }}>→</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2: Switch Network */}
          {step === "switch-network" && selectedNetwork && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  border: "4px solid #e5e7eb",
                  borderTop: "4px solid #f59e0b",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 20px",
                }}
              />
              <h3 style={{ margin: "0 0 10px 0", color: "#333" }}>
                🔄 Switching to {NETWORKS[selectedNetwork].displayName}
              </h3>
              <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
                {isSwitching
                  ? "Please confirm the network switch in your wallet..."
                  : "Preparing to switch network..."}
              </p>

              {error && (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "15px",
                    backgroundColor: "#fee",
                    borderRadius: "8px",
                    border: "1px solid #fcc",
                  }}
                >
                  <div style={{ fontSize: "14px", color: "#c00" }}>{error}</div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Loading Fee */}
          {step === "loading-fee" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  border: "4px solid #e5e7eb",
                  borderTop: "4px solid #3b82f6",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 20px",
                }}
              />
              <h3 style={{ margin: "0 0 10px 0", color: "#333" }}>Loading Fee Information...</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
                Querying facilitator for optimal fee
              </p>
            </div>
          )}

          {/* Step 4: Confirm Payment */}
          {step === "confirm-payment" && feeInfo && selectedNetwork && (
            <>
              <h2 style={{ marginTop: 0, marginBottom: "20px", color: "#333" }}>
                💳 Confirm Payment
              </h2>

              {/* Network Info */}
              <div
                style={{
                  marginBottom: "20px",
                  padding: "15px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <span style={{ fontSize: "24px" }}>{NETWORKS[selectedNetwork].icon}</span>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "16px" }}>
                      {NETWORKS[selectedNetwork].displayName}
                    </div>
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>
                      {NETWORKS[selectedNetwork].name}
                    </div>
                  </div>
                  <button
                    onClick={handleResetNetworkSelection}
                    disabled={isPaying}
                    style={{
                      marginLeft: "auto",
                      padding: "6px 12px",
                      fontSize: "13px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      backgroundColor: "white",
                      cursor: isPaying ? "not-allowed" : "pointer",
                      opacity: isPaying ? 0.5 : 1,
                    }}
                  >
                    Change
                  </button>
                </div>
                {address && (
                  <div style={{ fontSize: "13px", color: "#6b7280", fontFamily: "monospace" }}>
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </div>
                )}
              </div>

              {/* Fee Breakdown */}
              <div
                style={{
                  marginBottom: "20px",
                  padding: "20px",
                  backgroundColor: "#f0f9ff",
                  borderRadius: "8px",
                  border: "1px solid #bfdbfe",
                }}
              >
                <h3 style={{ margin: "0 0 15px 0", fontSize: "16px", color: "#1e40af" }}>
                  💰 Payment Breakdown
                </h3>

                <div
                  style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}
                >
                  <span style={{ color: "#4b5563" }}>Payment Amount:</span>
                  <span style={{ fontWeight: "600", fontFamily: "monospace" }}>
                    ${amountInUsd}
                  </span>
                </div>

                <div
                  style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}
                >
                  <span style={{ color: "#4b5563" }}>Facilitator Fee:</span>
                  <span style={{ fontWeight: "600", fontFamily: "monospace", color: "#059669" }}>
                    ${(parseFloat(feeInfo.facilitatorFee) / 1_000_000).toFixed(6)} USDC
                  </span>
                </div>

                <div
                  style={{
                    borderTop: "1px solid #bfdbfe",
                    marginTop: "12px",
                    paddingTop: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontWeight: "600", fontSize: "16px" }}>Total:</span>
                  <span
                    style={{
                      fontWeight: "700",
                      fontSize: "18px",
                      fontFamily: "monospace",
                      color: "#1e40af",
                    }}
                  >
                    ${totalAmount} USDC
                  </span>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "15px",
                    backgroundColor: "#fee",
                    borderRadius: "8px",
                    border: "1px solid #fcc",
                  }}
                >
                  <div style={{ fontSize: "14px", color: "#c00" }}>❌ {error}</div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={onClose}
                  disabled={isPaying}
                  style={{
                    flex: 1,
                    padding: "14px 24px",
                    fontSize: "16px",
                    fontWeight: "600",
                    border: "2px solid #e5e7eb",
                    borderRadius: "8px",
                    backgroundColor: "white",
                    color: "#374151",
                    cursor: isPaying ? "not-allowed" : "pointer",
                    opacity: isPaying ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePay}
                  disabled={isPaying}
                  style={{
                    flex: 2,
                    padding: "14px 24px",
                    fontSize: "16px",
                    fontWeight: "600",
                    border: "none",
                    borderRadius: "8px",
                    backgroundColor: isPaying ? "#9ca3af" : "#3b82f6",
                    color: "white",
                    cursor: isPaying ? "not-allowed" : "pointer",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isPaying) e.currentTarget.style.backgroundColor = "#2563eb";
                  }}
                  onMouseLeave={(e) => {
                    if (!isPaying) e.currentTarget.style.backgroundColor = "#3b82f6";
                  }}
                >
                  {isPaying ? "⏳ Processing..." : `💳 Pay $${totalAmount} USDC`}
                </button>
              </div>
            </>
          )}

          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>

      {/* Wallet Selector Modal */}
      <WalletSelector isOpen={showWalletSelector} onClose={() => setShowWalletSelector(false)} />
    </>
  );
}
