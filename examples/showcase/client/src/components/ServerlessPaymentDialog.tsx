/**
 * Serverless Payment Dialog Component
 * Complete payment flow: network selection → fee display → payment confirmation
 */

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { TransferHook } from '@x402x/core';
import { useX402Client } from '@x402x/client';
import type { FeeCalculationResult } from '@x402x/client';
import { useNetworkSwitch } from '../hooks/useNetworkSwitch';
import { type Network, NETWORKS, getPreferredNetwork, setPreferredNetwork, getFacilitatorUrl } from '../config';

type PaymentStep = 'select-network' | 'switch-network' | 'loading-fee' | 'confirm-payment';

interface ServerlessPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string; // In atomic units (e.g., "100000" for 0.1 USDC)
  recipient: string;
  onSuccess?: (result: { txHash: string; network: Network }) => void;
  onError?: (error: string) => void;
}

export function ServerlessPaymentDialog({
  isOpen,
  onClose,
  amount,
  recipient,
  onSuccess,
  onError,
}: ServerlessPaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>('select-network');
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [feeInfo, setFeeInfo] = useState<FeeCalculationResult | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { address, isConnected, chain } = useAccount();
  const facilitatorUrl = getFacilitatorUrl(); // Get facilitator URL from config
  const client = useX402Client({ facilitatorUrl }); // Pass to client
  const { switchToNetwork, isSwitching } = useNetworkSwitch();

  // Load preferred network on open
  useEffect(() => {
    if (isOpen) {
      const preferred = getPreferredNetwork();
      if (preferred) {
        setSelectedNetwork(preferred);
        setStep('select-network');
      } else {
        setSelectedNetwork(null);
        setStep('select-network');
      }
      setFeeInfo(null);
      setError(null);
      setIsPaying(false);
    }
  }, [isOpen]);

  // Load fee when network is selected
  const handleNetworkSelect = async (network: Network) => {
    setSelectedNetwork(network);
    setPreferredNetwork(network); // Remember user's choice
    setError(null);
    
    // Check if we need to switch network
    const targetChainId = NETWORKS[network].chainId;
    if (chain?.id !== targetChainId) {
      setStep('switch-network');
    } else {
      // Already on correct network, load fee directly
      setStep('loading-fee');
      await loadFee(network);
    }
  };

  // Auto-switch network when entering switch-network step
  useEffect(() => {
    if (step === 'switch-network' && selectedNetwork && isConnected) {
      const switchNetwork = async () => {
        const success = await switchToNetwork(selectedNetwork);
        if (success) {
          // Switch successful, load fee
          setStep('loading-fee');
          await loadFee(selectedNetwork);
        } else {
          // Switch failed, go back to selection
          setError(`Failed to switch to ${NETWORKS[selectedNetwork].displayName}. Please try again or select a different network.`);
          setStep('select-network');
        }
      };
      switchNetwork();
    }
  }, [step, selectedNetwork, isConnected, switchToNetwork]);

  // Helper function to load fee
  const loadFee = async (network: Network) => {
    try {
      if (!client) {
        throw new Error('Please connect your wallet first');
      }

      const hook = TransferHook.getAddress(network);
      const hookData = TransferHook.encode();
      
      const fee = await client.calculateFee(hook as `0x${string}`, hookData as `0x${string}`);
      
      setFeeInfo(fee);
      setStep('confirm-payment');
    } catch (err: any) {
      console.error('Failed to load fee:', err);
      setError(err.message || 'Failed to load facilitator fee');
      setStep('select-network');
    }
  };

  // Handle payment
  const handlePay = async () => {
    if (!client || !selectedNetwork || !feeInfo) {
      return;
    }

    setIsPaying(true);
    setError(null);

    try {
      const hook = TransferHook.getAddress(selectedNetwork);
      const hookData = TransferHook.encode();

      const result = await client.execute({
        hook: hook as `0x${string}`,
        hookData: hookData as `0x${string}`,
        amount,
        recipient: recipient as `0x${string}`,
        facilitatorFee: feeInfo.facilitatorFee,
      }, true);

      console.log('[ServerlessPaymentDialog] Execute result:', result);
      console.log('[ServerlessPaymentDialog] Selected network:', selectedNetwork);
      onSuccess?.({ txHash: result.txHash, network: selectedNetwork });
      onClose();
    } catch (err: any) {
      console.error('Payment failed:', err);
      const errorMsg = err.message || 'Payment failed';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsPaying(false);
    }
  };

  if (!isOpen) return null;

  // Format amount for display
  const amountInUsdc = (parseFloat(amount) / 1_000_000).toFixed(2);
  const totalAmount = feeInfo 
    ? ((parseFloat(amount) + parseFloat(feeInfo.facilitatorFee)) / 1_000_000).toFixed(6)
    : amountInUsdc;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={!isPaying ? onClose : undefined}
      >
        {/* Dialog */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            position: 'relative',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          {!isPaying && (
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: '5px 10px',
                lineHeight: '1',
              }}
              title="Close"
            >
              ×
            </button>
          )}

          {/* Step 1: Network Selection */}
          {step === 'select-network' && (
            <>
              <h2 style={{ marginTop: 0, marginBottom: '10px', color: '#333' }}>
                🌐 Select Payment Network
              </h2>
              <p style={{ marginBottom: '25px', color: '#666', fontSize: '14px' }}>
                Choose the blockchain network for your ${amountInUsdc} USDC payment
              </p>

              {!isConnected && (
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '15px', 
                  backgroundColor: '#fff3cd', 
                  borderRadius: '8px',
                  border: '1px solid #ffeaa7'
                }}>
                  <div style={{ fontSize: '14px', color: '#856404' }}>
                    ⚠️ Please connect your wallet first using the button in the header
                  </div>
                </div>
              )}

              {error && (
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '15px', 
                  backgroundColor: '#fee', 
                  borderRadius: '8px',
                  border: '1px solid #fcc'
                }}>
                  <div style={{ fontSize: '14px', color: '#c00' }}>
                    ❌ {error}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(NETWORKS).map(([key, networkConfig]) => (
                  <button
                    key={key}
                    onClick={() => handleNetworkSelect(key as Network)}
                    disabled={!isConnected}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '15px',
                      padding: '18px 20px',
                      border: selectedNetwork === key ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                      borderRadius: '10px',
                      backgroundColor: selectedNetwork === key ? '#f0f9ff' : 'white',
                      cursor: isConnected ? 'pointer' : 'not-allowed',
                      opacity: isConnected ? 1 : 0.5,
                      transition: 'all 0.2s',
                      textAlign: 'left',
                      fontSize: '16px',
                      fontWeight: '500',
                    }}
                    onMouseEnter={(e) => {
                      if (isConnected) {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.backgroundColor = '#f0f9ff';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isConnected && selectedNetwork !== key) {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <span style={{ fontSize: '32px' }}>{networkConfig.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#111', marginBottom: '2px' }}>
                        {networkConfig.displayName}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        {networkConfig.name}
                      </div>
                    </div>
                    <span style={{ color: '#3b82f6', fontSize: '20px' }}>→</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2: Switch Network */}
          {step === 'switch-network' && selectedNetwork && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                border: '4px solid #e5e7eb',
                borderTop: '4px solid #f59e0b',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px'
              }} />
              <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>
                🔄 Switching to {NETWORKS[selectedNetwork].displayName}
              </h3>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                {isSwitching ? 'Please confirm the network switch in your wallet...' : 'Preparing to switch network...'}
              </p>
              
              {error && (
                <div style={{ 
                  marginTop: '20px', 
                  padding: '15px', 
                  backgroundColor: '#fee', 
                  borderRadius: '8px',
                  border: '1px solid #fcc'
                }}>
                  <div style={{ fontSize: '14px', color: '#c00' }}>
                    {error}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Loading Fee */}
          {step === 'loading-fee' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                border: '4px solid #e5e7eb',
                borderTop: '4px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px'
              }} />
              <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>
                Loading Fee Information...
              </h3>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Querying facilitator for optimal fee
              </p>
            </div>
          )}

          {/* Step 4: Confirm Payment */}
          {step === 'confirm-payment' && feeInfo && selectedNetwork && (
            <>
              <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>
                💳 Confirm Payment
              </h2>

              {/* Network Info */}
              <div style={{ 
                marginBottom: '20px', 
                padding: '15px', 
                backgroundColor: '#f9fafb', 
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '24px' }}>{NETWORKS[selectedNetwork].icon}</span>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px' }}>
                      {NETWORKS[selectedNetwork].displayName}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {NETWORKS[selectedNetwork].name}
                    </div>
                  </div>
                  <button
                    onClick={() => setStep('select-network')}
                    disabled={isPaying}
                    style={{
                      marginLeft: 'auto',
                      padding: '6px 12px',
                      fontSize: '13px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: 'white',
                      cursor: isPaying ? 'not-allowed' : 'pointer',
                      opacity: isPaying ? 0.5 : 1,
                    }}
                  >
                    Change
                  </button>
                </div>
                {address && (
                  <div style={{ fontSize: '13px', color: '#6b7280', fontFamily: 'monospace' }}>
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </div>
                )}
              </div>

              {/* Fee Breakdown */}
              <div style={{ 
                marginBottom: '20px', 
                padding: '20px', 
                backgroundColor: '#f0f9ff', 
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#1e40af' }}>
                  💰 Payment Breakdown
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: '#4b5563' }}>Payment Amount:</span>
                  <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                    ${amountInUsdc} USDC
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: '#4b5563' }}>Facilitator Fee:</span>
                  <span style={{ fontWeight: '600', fontFamily: 'monospace', color: '#059669' }}>
                    ${(parseFloat(feeInfo.facilitatorFee) / 1_000_000).toFixed(6)} USDC
                  </span>
                </div>

                <div style={{ 
                  borderTop: '1px solid #bfdbfe', 
                  marginTop: '12px', 
                  paddingTop: '12px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontWeight: '600', fontSize: '16px' }}>Total:</span>
                  <span style={{ fontWeight: '700', fontSize: '18px', fontFamily: 'monospace', color: '#1e40af' }}>
                    ${totalAmount} USDC
                  </span>
                </div>
              </div>

              {error && (
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '15px', 
                  backgroundColor: '#fee', 
                  borderRadius: '8px',
                  border: '1px solid #fcc'
                }}>
                  <div style={{ fontSize: '14px', color: '#c00' }}>
                    ❌ {error}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={onClose}
                  disabled={isPaying}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: isPaying ? 'not-allowed' : 'pointer',
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
                    padding: '14px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: isPaying ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    cursor: isPaying ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isPaying) e.currentTarget.style.backgroundColor = '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    if (!isPaying) e.currentTarget.style.backgroundColor = '#3b82f6';
                  }}
                >
                  {isPaying ? '⏳ Processing...' : `💳 Pay $${totalAmount} USDC`}
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
    </>
  );
}

