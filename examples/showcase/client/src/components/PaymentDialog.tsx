/**
 * Payment Dialog Component
 * Handles the complete payment flow: network selection → wallet connection → payment execution
 */

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { WalletSelector } from './WalletSelector';
import { PaymentStatus } from './PaymentStatus';
import { usePayment } from '../hooks/usePayment';
import { useNetworkSwitch } from '../hooks/useNetworkSwitch';
import { useNetworkBalances } from '../hooks/useNetworkBalances';
import { Network, NETWORKS, getNetworkByChainId, setPreferredNetwork, buildApiUrl } from '../config';

type PaymentStep = 'select-network' | 'switch-network' | 'confirm-payment' | 'processing';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  currency: string;
  endpoint: string;
  requestBody?: any;
  getRequestBody?: (address: string) => any; // Dynamic request body generator
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function PaymentDialog({
  isOpen,
  onClose,
  amount,
  currency,
  endpoint,
  requestBody,
  getRequestBody,
  onSuccess,
  onError,
}: PaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>('select-network');
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [paymentRequirements, setPaymentRequirements] = useState<any>(null);
  const [allowAutoSelectPreferred, setAllowAutoSelectPreferred] = useState(true);
  
  const { address, isConnected, chain } = useAccount();
  const { switchToNetwork, isSwitching } = useNetworkSwitch();
  const { status, error, result, pay, reset, debugInfo } = usePayment();
  const balances = useNetworkBalances(address);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowWalletSelector(false);
      setPaymentRequirements(null);
      setAllowAutoSelectPreferred(true);
      reset();

      // Reset to network selection (PaymentMethodSelector may auto-select preferred network)
      setSelectedNetwork(null);
      setStep('select-network');
    }
  }, [isOpen]);

  // Handle wallet connection changes
  useEffect(() => {
    if (!isOpen || !selectedNetwork) return;
    
    // If we're at network selection and wallet just connected, automatically continue
    if (step === 'select-network' && isConnected && !showWalletSelector) {
      const currentNetwork = chain ? getNetworkByChainId(chain.id) : null;
      if (currentNetwork !== selectedNetwork) {
        setStep('switch-network');
      } else {
        setStep('confirm-payment');
      }
    }
    
  }, [isConnected, chain, selectedNetwork, step, isOpen, showWalletSelector]);

  // Handle network switching
  useEffect(() => {
    if (step === 'switch-network' && selectedNetwork && isConnected) {
      const switchNetwork = async () => {
        const success = await switchToNetwork(selectedNetwork);
        if (success) {
          setStep('confirm-payment');
        }
      };
      switchNetwork();
    }
  }, [step, selectedNetwork, isConnected, switchToNetwork]);

  // Track payment requirements from debugInfo
  useEffect(() => {
    if (debugInfo?.paymentRequirements) {
      setPaymentRequirements(debugInfo.paymentRequirements);
    }
  }, [debugInfo]);

  // Handle payment status changes
  useEffect(() => {
    if (status === 'success' && result && onSuccess) {
      onSuccess(result);
    } else if (status === 'error' && error && onError) {
      onError(error);
    }
  }, [status, result, error, onSuccess, onError]);

  const handleNetworkSelect = (network: Network) => {
    if (allowAutoSelectPreferred) {
      // Ignore the initial auto-selection triggered by the selector,
      // only highlight the preferred network without advancing the flow.
      setAllowAutoSelectPreferred(false);
      setSelectedNetwork(network);
      setPreferredNetwork(network);
      return;
    }

    setAllowAutoSelectPreferred(false);
    setSelectedNetwork(network);
    // Save user's preference
    setPreferredNetwork(network);
    
    // If wallet not connected, open wallet selector
    if (!isConnected) {
      setShowWalletSelector(true);
      return;
    }
    
    // Wallet connected, check if on correct network
    const currentNetwork = chain ? getNetworkByChainId(chain.id) : null;
    if (currentNetwork !== network) {
      setStep('switch-network');
    } else {
      setStep('confirm-payment');
    }
  };

  const handleChangeNetwork = () => {
    setAllowAutoSelectPreferred(false);
    setPaymentRequirements(null);
    setSelectedNetwork(null);
    setShowWalletSelector(false);
    setStep('select-network');
  };

  const handleWalletConnected = () => {
    setShowWalletSelector(false);
    // The useEffect will handle advancing to the next step
  };

  // Pre-fetch payment requirements when entering confirm-payment step
  useEffect(() => {
    const fetchPaymentRequirements = async () => {
      if (step === 'confirm-payment' && selectedNetwork && address && !paymentRequirements) {
        try {
          const finalRequestBody = getRequestBody ? getRequestBody(address) : requestBody;
          const requestBodyWithNetwork = { ...finalRequestBody, network: selectedNetwork };
          
          const fullUrl = buildApiUrl(endpoint);
          const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBodyWithNetwork),
          });

          if (response.status === 402) {
            const paymentResponse = await response.json();
            const paymentReq = paymentResponse.accepts?.find((req: any) => req.network === selectedNetwork);
            if (paymentReq) {
              setPaymentRequirements(paymentReq);
            }
          }
        } catch (err) {
          console.error('[PaymentDialog] Failed to pre-fetch payment requirements:', err);
        }
      }
    };

    fetchPaymentRequirements();
  }, [step, selectedNetwork, address, endpoint, requestBody, getRequestBody, paymentRequirements]);

  const handleConfirmPayment = async () => {
    if (!selectedNetwork || !address) return;
    
    setStep('processing');
    try {
      // Use dynamic request body if provided, otherwise use static requestBody
      const finalRequestBody = getRequestBody ? getRequestBody(address) : requestBody;
      await pay(endpoint, selectedNetwork, finalRequestBody);
    } catch (err) {
      // Error handled by usePayment hook and passed to onError via useEffect
    }
  };

  const handleClose = () => {
    if (step !== 'processing') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentNetwork = chain ? getNetworkByChainId(chain.id) : null;
  const isOnCorrectNetwork = currentNetwork === selectedNetwork;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            Pay {amount} {currency}
          </h2>
          {step !== 'processing' && (
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: '0',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Step 1: Select Network */}
        {step === 'select-network' && (
          <div>
            <PaymentMethodSelector
              amount={amount}
              currency={currency}
              balances={balances}
              selectedNetwork={selectedNetwork}
              onSelect={handleNetworkSelect}
              disabled={false}
              showBalances={false} // Don't show balances in network selection step
              autoSelectPreferred={allowAutoSelectPreferred}
            />
          </div>
        )}

        {/* Step 2: Switch Network */}
        {step === 'switch-network' && selectedNetwork && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', marginBottom: '10px' }}>
              Switching to <strong>{NETWORKS[selectedNetwork].displayName}</strong>
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
              {isSwitching ? 'Please confirm the network switch in your wallet...' : 'Preparing to switch network...'}
            </div>
            <div style={{ 
              display: 'inline-block',
              width: '32px',
              height: '32px',
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #4A90E2',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '20px',
            }} />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
            
            <button
              onClick={handleChangeNetwork}
              disabled={isSwitching}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                color: isSwitching ? '#ccc' : '#4A90E2',
                border: `1px solid ${isSwitching ? '#ccc' : '#4A90E2'}`,
                borderRadius: '8px',
                fontSize: '14px',
                cursor: isSwitching ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Change Network
            </button>
          </div>
        )}

        {/* Step 3: Confirm Payment */}
        {step === 'confirm-payment' && selectedNetwork && isConnected && isOnCorrectNetwork && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', marginBottom: '10px', textAlign: 'center' }}>
                Ready to Pay
              </div>
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                {paymentRequirements?.extra?.businessAmount ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Business Amount:</span>
                      <strong>{(parseFloat(paymentRequirements.extra.businessAmount) / 1000000).toFixed(6)} {currency}</strong>
                    </div>
                    {paymentRequirements?.extra?.facilitatorFee && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>Facilitator Fee:</span>
                        <strong>{(parseFloat(paymentRequirements.extra.facilitatorFee) / 1000000).toFixed(6)} {currency}</strong>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid #dee2e6', margin: '8px 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span><strong>Total Amount:</strong></span>
                      <strong>{(parseFloat(paymentRequirements.maxAmountRequired) / 1000000).toFixed(6)} {currency}</strong>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Amount:</span>
                    <strong>{amount} {currency}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Network:</span>
                  <strong>{NETWORKS[selectedNetwork].displayName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Wallet:</span>
                  <strong>{address?.slice(0, 6)}...{address?.slice(-4)}</strong>
                </div>
              </div>
              
              {/* Show balance if available */}
              {balances[selectedNetwork] && !balances[selectedNetwork].loading && (
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: parseFloat(balances[selectedNetwork].balance) >= parseFloat(amount) ? '#d4edda' : '#f8d7da',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Your Balance:</span>
                    <strong>{balances[selectedNetwork].balance} {currency}</strong>
                  </div>
                  {parseFloat(balances[selectedNetwork].balance) < parseFloat(amount) && (
                    <div style={{ marginTop: '8px', color: '#721c24' }}>
                      ⚠️ Insufficient balance. 
                      <a 
                        href={NETWORKS[selectedNetwork].faucetUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ marginLeft: '8px', color: '#721c24' }}
                      >
                        Get test {currency}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleConfirmPayment}
              disabled={balances[selectedNetwork] && parseFloat(balances[selectedNetwork].balance) < parseFloat(amount)}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                opacity: balances[selectedNetwork] && parseFloat(balances[selectedNetwork].balance) < parseFloat(amount) ? 0.6 : 1,
                marginBottom: '12px',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#218838';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#28a745';
                }
              }}
            >
              Confirm Payment
            </button>

            <button
              onClick={handleChangeNetwork}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                color: '#6c757d',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
                e.currentTarget.style.borderColor = '#adb5bd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = '#dee2e6';
              }}
            >
              Change Network
            </button>
          </div>
        )}

        {/* Step 4: Processing Payment */}
        {step === 'processing' && (
          <div>
            <PaymentStatus
              status={status}
              error={error}
              successMessage="Payment completed successfully!"
            />
            
            {status === 'success' && (
              <button
                onClick={handleClose}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginTop: '16px',
                }}
              >
                Close
              </button>
            )}
            
            {status === 'error' && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={() => setStep('confirm-payment')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Wallet Selector Modal */}
        <WalletSelector 
          isOpen={showWalletSelector} 
          onClose={() => {
            setShowWalletSelector(false);
            // Check if wallet got connected
            if (isConnected) {
              handleWalletConnected();
            }
          }} 
        />
      </div>
    </div>
  );
}
