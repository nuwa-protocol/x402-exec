/**
 * Payment Dialog Component V2 - With Accept Option Selection
 * Uses official x402 SDK with x402x extension
 * 
 * Follows v2 negotiation: probe 402 → parse accepts[] → user selects → pay
 * 
 * Key Design: Uses x402x getNetworkConfig for CAIP-2 networks, bypassing local NETWORKS hardcoding
 */

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequired, PaymentRequirements } from "@x402/core/types";
import { WalletSelector } from "./WalletSelector";
import { PaymentStatus } from "./PaymentStatus";
import { usePaymentV2 } from "../hooks/usePaymentV2";
import { useNetworkSwitch } from "../hooks/useNetworkSwitch";
import { useNetworkBalances } from "../hooks/useNetworkBalances";
import { buildApiUrl, getNetworkByChainId, type Network } from "../config";
import { formatUnits } from "viem";
import { getNetworkConfig } from "@x402x/extensions";

type PaymentStep = "probing" | "select-option" | "switch-network" | "confirm-payment" | "processing";

interface PaymentDialogV2Props {
  isOpen: boolean;
  onClose: () => void;
  amount: string; // e.g., "$0.10"
  currency: string; // e.g., "USDC"
  endpoint: string;
  requestBody?: any;
  getRequestBody?: (address: string) => any;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function PaymentDialogV2({
  isOpen,
  onClose,
  amount,
  currency,
  endpoint,
  requestBody,
  getRequestBody,
  onSuccess,
  onError,
}: PaymentDialogV2Props) {
  const [step, setStep] = useState<PaymentStep>("probing");
  const [paymentRequired, setPaymentRequired] = useState<PaymentRequired | null>(null);
  const [selectedAcceptIndex, setSelectedAcceptIndex] = useState<number | null>(null);
  const [probeError, setProbeError] = useState<string>("");
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  const { address, isConnected, chain } = useAccount();
  const { switchToNetwork, isSwitching } = useNetworkSwitch();
  const { status, error, result, pay, reset } = usePaymentV2();
  const balances = useNetworkBalances(address);

  // Parse numeric amount from string like "$0.10" -> "0.10"
  const numericAmount = amount.replace(/[^0-9.]/g, "");

  // Probe 402 when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    const probe402 = async () => {
      setStep("probing");
      setProbeError("");
      setPaymentRequired(null);
      setSelectedAcceptIndex(null);
      reset();

      try {
        const fullUrl = buildApiUrl(endpoint);
        const probeBody = getRequestBody && address ? getRequestBody(address) : requestBody;

        const response = await fetch(fullUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(probeBody),
        });

        if (response.status === 402) {
          const paymentRequiredHeader =
            response.headers.get("PAYMENT-REQUIRED") || response.headers.get("payment-required");
          if (!paymentRequiredHeader) {
            throw new Error("402 response missing PAYMENT-REQUIRED header");
          }

          const parsed = decodePaymentRequiredHeader(paymentRequiredHeader);
          setPaymentRequired(parsed);
          setStep("select-option");

          // Auto-select best option (B strategy)
          autoSelectBestOption(parsed.accepts);
        } else {
          throw new Error(`Expected 402, got ${response.status}`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to probe payment requirements";
        setProbeError(errMsg);
        setStep("select-option"); // Still show UI even if probe fails
      }
    };

    probe402();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-select best payment option
  const autoSelectBestOption = (accepts: PaymentRequirements[]) => {
    if (!accepts || accepts.length === 0) return;

    // Strategy: 1) preferred network (CAIP-2), 2) current wallet chain, 3) first with sufficient balance
    const currentChainId = chain?.id;
    const currentNetworkCaip2 = currentChainId ? `eip155:${currentChainId}` : null;

    // Try preferred network from localStorage (stored as CAIP-2)
    const preferredNetworkCaip2 = localStorage.getItem("x402-preferred-network-caip2");
    if (preferredNetworkCaip2) {
      const idx = accepts.findIndex((a) => a.network === preferredNetworkCaip2);
      if (idx !== -1) {
        setSelectedAcceptIndex(idx);
        return;
      }
    }

    // Try current wallet chain
    if (currentNetworkCaip2) {
      const idx = accepts.findIndex((a) => a.network === currentNetworkCaip2);
      if (idx !== -1) {
        setSelectedAcceptIndex(idx);
        return;
      }
    }

    // Fall back to first option with sufficient balance (if connected)
    if (address && balances) {
      for (let i = 0; i < accepts.length; i++) {
        const accept = accepts[i];
        
        // Use x402x config to get decimals for balance check
        const networkCfg = getNetworkConfig(accept.network);
        if (!networkCfg) continue;

        // Convert CAIP-2 to local v1 network for balance lookup
        const networkV1 = getNetworkV1FromCaip2(accept.network);
        if (!networkV1) continue;
        
        const balance = balances[networkV1];
        if (!balance || balance.loading || balance.error) continue;

        const required = parseFloat(numericAmount);
        const available = parseFloat(balance.balance);
        if (available >= required) {
          setSelectedAcceptIndex(i);
          return;
        }
      }
    }

    // Default to first option
    setSelectedAcceptIndex(0);
  };

  // Helper: convert CAIP-2 to v1 network name
  const getNetworkV1FromCaip2 = (caip2: string): Network | null | undefined => {
    const chainIdStr = caip2.split(":")[1];
    if (!chainIdStr) return null;
    const chainId = parseInt(chainIdStr, 10);
    return getNetworkByChainId(chainId);
  };

  // Handle user selecting an accept option
  const handleAcceptSelect = (index: number) => {
    setSelectedAcceptIndex(index);
  };

  // Handle confirming selection and proceeding to payment
  const handleProceedToPayment = async () => {
    if (selectedAcceptIndex === null || !paymentRequired) return;

    const selectedAccept = paymentRequired.accepts[selectedAcceptIndex];
    const networkV1 = getNetworkV1FromCaip2(selectedAccept.network);

    if (!isConnected) {
      setShowWalletSelector(true);
      return;
    }

    if (!networkV1) {
      onError?.("Unsupported network");
      return;
    }

    // Check if we need to switch network
    const currentNetwork = chain ? getNetworkByChainId(chain.id) : null;
    if (currentNetwork !== networkV1) {
      setStep("switch-network");
      const success = await switchToNetwork(networkV1);
      if (!success) {
        onError?.(`Failed to switch to ${networkV1}`);
        return;
      }
    }

    setStep("confirm-payment");
  };

  const handleConfirmPayment = async () => {
    if (selectedAcceptIndex === null || !paymentRequired || !address) return;

    setStep("processing");
    try {
      const selectedAccept = paymentRequired.accepts[selectedAcceptIndex];
      const finalRequestBody = getRequestBody ? getRequestBody(address) : requestBody;
      
      // Pass the network and selected accept requirements
      // usePaymentV2 will use paymentRequirementsSelector to match the selected option
      await pay(endpoint, selectedAccept.network, finalRequestBody);
    } catch (err) {
      console.error("[PaymentDialog] Payment failed:", err);
    }
  };

  const handleChangeOption = () => {
    setStep("select-option");
  };

  const handleWalletConnected = () => {
    setShowWalletSelector(false);
    handleProceedToPayment();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Handle payment status changes
  useEffect(() => {
    if (status === "success" && result) {
      onSuccess?.(result);
    } else if (status === "error" && error) {
      onError?.(error);
    }
  }, [status, result, error, onSuccess, onError]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            paddingBottom: "16px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>Complete Payment</h2>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "28px",
              cursor: "pointer",
              color: "#6b7280",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        <div>
          {step === "probing" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "3px solid #e5e7eb",
                  borderTopColor: "#667eea",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 16px",
                }}
              />
              <p>Loading payment options...</p>
            </div>
          )}

          {step === "select-option" && (
            <>
              {!showWalletSelector ? (
                <>
                  <p style={{ marginBottom: "20px", fontSize: "16px" }}>
                    Pay <strong>{amount} {currency}</strong>
                  </p>

                  {probeError && (
                    <div
                      style={{
                        backgroundColor: "#fee2e2",
                        border: "1px solid #fecaca",
                        borderRadius: "8px",
                        padding: "12px",
                        marginBottom: "16px",
                        color: "#991b1b",
                      }}
                    >
                      {probeError}
                    </div>
                  )}

                  {paymentRequired && paymentRequired.accepts.length > 0 ? (
                    <>
                      <div style={{ marginBottom: "16px" }}>
                        <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>
                          Choose Payment Network
                        </h3>
                        {paymentRequired.accepts.map((accept, index) => {
                          const networkV1 = getNetworkV1FromCaip2(accept.network);
                          const balance = networkV1 ? balances[networkV1] : null;
                          const isSelected = selectedAcceptIndex === index;

                          // Use x402x network config directly (CAIP-2)
                          const networkCfg = getNetworkConfig(accept.network);
                          const displayName = networkCfg?.name || accept.network;
                          const icon = "🌐"; // Default icon for now
                          const decimals = networkCfg?.defaultAsset.decimals || 6;

                          // Parse amount
                          const acceptAmount = accept.amount || "0";
                          const amountBigInt = BigInt(acceptAmount);
                          const formattedAmount = formatUnits(amountBigInt, decimals);

                          const hasBalance = balance
                            ? parseFloat(balance.balance) >= parseFloat(formattedAmount)
                            : false;

                          return (
                            <button
                              key={index}
                              onClick={() => handleAcceptSelect(index)}
                              style={{
                                width: "100%",
                                padding: "16px",
                                marginBottom: "8px",
                                border: isSelected ? "2px solid #667eea" : "1px solid #e5e7eb",
                                borderRadius: "8px",
                                backgroundColor: isSelected ? "#f0f4ff" : "white",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.2s",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                                    {icon} {displayName}
                                  </div>
                                  <div style={{ fontSize: "14px", color: "#6b7280" }}>
                                    Amount: {formattedAmount} {currency}
                                  </div>
                                  {balance && !balance.loading && !balance.error && (
                                    <div
                                      style={{
                                        fontSize: "14px",
                                        color: hasBalance ? "#10b981" : "#ef4444",
                                        marginTop: "4px",
                                      }}
                                    >
                                      Balance: {balance.balance} {currency}
                                      {!hasBalance && " (Insufficient)"}
                                    </div>
                                  )}
                                </div>
                                <div
                                  style={{
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "50%",
                                    border: isSelected ? "6px solid #667eea" : "2px solid #d1d5db",
                                  }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={handleProceedToPayment}
                        disabled={selectedAcceptIndex === null}
                        style={{
                          width: "100%",
                          padding: "12px",
                          backgroundColor: selectedAcceptIndex !== null ? "#667eea" : "#d1d5db",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "16px",
                          fontWeight: "600",
                          cursor: selectedAcceptIndex !== null ? "pointer" : "not-allowed",
                        }}
                      >
                        Continue
                      </button>
                    </>
                  ) : (
                    <p style={{ color: "#6b7280", textAlign: "center", padding: "20px" }}>
                      No payment options available
                    </p>
                  )}
                </>
              ) : (
                <WalletSelector isOpen={showWalletSelector} onClose={handleWalletConnected} />
              )}
            </>
          )}

          {step === "switch-network" && paymentRequired && selectedAcceptIndex !== null && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <h3 style={{ marginBottom: "12px" }}>Switch Network</h3>
              <p style={{ color: "#6b7280", marginBottom: "20px" }}>
                Please switch to{" "}
                {(() => {
                  const selectedNetwork = paymentRequired.accepts[selectedAcceptIndex].network;
                  const networkCfg = getNetworkConfig(selectedNetwork);
                  return networkCfg?.name || selectedNetwork;
                })()}{" "}
                in your wallet
              </p>
              {isSwitching && (
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid #e5e7eb",
                    borderTopColor: "#667eea",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto",
                  }}
                />
              )}
            </div>
          )}

          {step === "confirm-payment" && paymentRequired && selectedAcceptIndex !== null && (
            <div style={{ padding: "20px 0" }}>
              <h3 style={{ marginBottom: "20px" }}>Confirm Payment</h3>
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ color: "#6b7280" }}>Amount:</span>
                  <strong>{amount} {currency}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Network:</span>
                  <strong>
                    {(() => {
                      const selectedNetwork = paymentRequired.accepts[selectedAcceptIndex].network;
                      const networkCfg = getNetworkConfig(selectedNetwork);
                      return networkCfg?.name || selectedNetwork;
                    })()}
                  </strong>
                </div>
              </div>
              <button
                onClick={handleConfirmPayment}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#667eea",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  marginBottom: "10px",
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#5568d3")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#667eea")}
              >
                Confirm & Pay
              </button>
              <button
                onClick={handleChangeOption}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "transparent",
                  color: "#667eea",
                  border: "1px solid #667eea",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Change Network
              </button>
            </div>
          )}

          {step === "processing" && <PaymentStatus status={status} error={error} />}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
