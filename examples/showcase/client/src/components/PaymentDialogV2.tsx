/**
 * Payment Dialog Component V2
 * Uses official x402 SDK with x402x extension
 * 
 * This is a simplified version that leverages the ExactEvmSchemeWithRouterSettlement
 * for cleaner payment processing.
 */

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { WalletSelector } from "./WalletSelector";
import { PaymentStatus } from "./PaymentStatus";
import { usePaymentV2 } from "../hooks/usePaymentV2";
import { useNetworkSwitch } from "../hooks/useNetworkSwitch";
import { useNetworkBalances } from "../hooks/useNetworkBalances";
import type { Network } from "../config";
import { getNetworkByChainId } from "../config";

type PaymentStep = "select-network" | "switch-network" | "confirm-payment" | "processing";

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
  const [step, setStep] = useState<PaymentStep>("select-network");
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  const { address, isConnected, chain } = useAccount();
  const { switchToNetwork, isSwitching } = useNetworkSwitch();
  const { status, error, result, pay, reset } = usePaymentV2();
  const balances = useNetworkBalances(address);

  // Parse numeric amount from string like "$0.10" -> "0.10"
  const numericAmount = amount.replace(/[^0-9.]/g, "");

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowWalletSelector(false);
      reset();
      setSelectedNetwork(null);
      setStep("select-network");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only depend on isOpen, not reset (it's stable)

  // Handle wallet connection changes
  useEffect(() => {
    if (!isOpen || !selectedNetwork) return;

    if (step === "select-network" && isConnected && !showWalletSelector) {
      const currentNetwork = chain ? getNetworkByChainId(chain.id) : null;
      if (currentNetwork !== selectedNetwork) {
        setStep("switch-network");
      } else {
        setStep("confirm-payment");
      }
    }
  }, [isConnected, chain, selectedNetwork, step, isOpen, showWalletSelector]);

  // Handle network switching
  useEffect(() => {
    if (step === "switch-network" && selectedNetwork && isConnected) {
      const switchNetwork = async () => {
        const success = await switchToNetwork(selectedNetwork);
        if (success) {
          setStep("confirm-payment");
        }
      };
      switchNetwork();
    }
  }, [step, selectedNetwork, isConnected, switchToNetwork]);

  // Handle payment status changes
  useEffect(() => {
    if (status === "success" && result) {
      onSuccess?.(result);
    } else if (status === "error" && error) {
      onError?.(error);
    }
  }, [status, result, error, onSuccess, onError]);

  const handleNetworkSelect = (network: Network) => {
    setSelectedNetwork(network);

    if (!isConnected) {
      setShowWalletSelector(true);
    } else {
      const currentNetwork = chain ? getNetworkByChainId(chain.id) : null;
      if (currentNetwork !== network) {
        setStep("switch-network");
      } else {
        setStep("confirm-payment");
      }
    }
  };

  const handleChangeNetwork = () => {
    setSelectedNetwork(null);
    setShowWalletSelector(false);
    setStep("select-network");
  };

  const handleWalletConnected = () => {
    setShowWalletSelector(false);
  };

  const handleConfirmPayment = async () => {
    if (!selectedNetwork || !address) return;

    setStep("processing");
    try {
      const finalRequestBody = getRequestBody ? getRequestBody(address) : requestBody;
      await pay(endpoint, selectedNetwork, finalRequestBody);
    } catch (err) {
      // Error handled by usePaymentV2 hook
      console.error("[PaymentDialog] Payment failed:", err);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

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
          {step === "select-network" && (
            <>
              {!showWalletSelector ? (
                <>
                  <p style={{ marginBottom: "20px", fontSize: "16px" }}>
                    Pay <strong>{amount} {currency}</strong>
                  </p>
                  <PaymentMethodSelector
                    amount={numericAmount}
                    currency={currency}
                    balances={balances}
                    selectedNetwork={selectedNetwork}
                    onSelect={handleNetworkSelect}
                    autoSelectPreferred={false}
                  />
                </>
              ) : (
                <WalletSelector
                  isOpen={showWalletSelector}
                  onClose={handleWalletConnected}
                />
              )}
            </>
          )}

          {step === "switch-network" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <h3 style={{ marginBottom: "12px" }}>Switch Network</h3>
              <p style={{ color: "#6b7280", marginBottom: "20px" }}>
                Please switch to {selectedNetwork} in your wallet
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

          {step === "confirm-payment" && (
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ color: "#6b7280" }}>Amount:</span>
                  <strong>{amount} {currency}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ color: "#6b7280" }}>Network:</span>
                  <strong>{selectedNetwork}</strong>
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
                onClick={handleChangeNetwork}
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

          {step === "processing" && (
            <PaymentStatus status={status} error={error} />
          )}
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

