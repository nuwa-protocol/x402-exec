/**
 * Serverless Split Payment Scenario
 * Allows users to create custom payment splits using TransferHook distributed transfers
 * Features:
 * - Dynamic recipient list (add/remove)
 * - Percentage-based splits (basis points)
 * - "Use My Address" button for wallet-connected users
 * - Validates total bips ≤ 10000 (remainder goes to payTo)
 */

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ServerlessPaymentDialog } from '../components/ServerlessPaymentDialog';
import { ScenarioCard } from '../components/ScenarioCard';
import { PaymentButton } from '../components/PaymentButton';
import { StatusMessage } from '../components/StatusMessage';
import { TransactionResult } from '../components/TransactionResult';
import { CodeBlock } from '../components/CodeBlock';
import { usePaymentFlow } from '../hooks/usePaymentFlow';
import splitPaymentCode from '../code-examples/split-payment.ts?raw';

// Default recipient from environment or fallback
const DEFAULT_RECIPIENT = import.meta.env.VITE_DEFAULT_RECIPIENT_ADDRESS || '0x1111111111111111111111111111111111111111';

const AMOUNT = '100000'; // 0.1 USDC (6 decimals)

interface Split {
  id: string;
  recipient: string;
  bips: string; // Percentage as string (0-10000)
}

export function ServerlessSplitPayment() {
  const { address: connectedAddress } = useAccount();
  // Primary recipient (payTo) - gets the remainder
  const [payTo, setPayTo] = useState<string>(DEFAULT_RECIPIENT);
  // Additional recipients - each gets specified bips
  const [splits, setSplits] = useState<Split[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { paymentResult, error, handleSuccess, handleError, reset, isCompleted } = usePaymentFlow();

  // Calculate totals
  const totalBips = splits.reduce((sum, split) => sum + (parseInt(split.bips) || 0), 0);
  const remainingBips = 10000 - totalBips;
  // Validate: total bips <= 10000, payTo exists, and all splits have recipient and valid bips
  const isValid = totalBips <= 10000 && 
    payTo.length > 0 && 
    splits.every(s => {
      const hasRecipient = s.recipient && s.recipient.length > 0;
      const hasBips = s.bips && s.bips.length > 0 && parseInt(s.bips) > 0;
      return hasRecipient && hasBips;
    });

  // Add a new split
  const addSplit = () => {
    const newId = (Math.max(0, ...splits.map(s => parseInt(s.id))) + 1).toString();
    setSplits([...splits, { id: newId, recipient: '', bips: '' }]);
  };

  // Remove a split
  const removeSplit = (id: string) => {
    setSplits(splits.filter(s => s.id !== id));
  };

  // Update a split
  const updateSplit = (id: string, field: 'recipient' | 'bips', value: string) => {
    setSplits(splits.map(s => {
      if (s.id === id) {
        // For bips, ensure it's numeric and within range
        if (field === 'bips') {
          const numValue = parseInt(value) || 0;
          return { ...s, [field]: Math.min(10000, Math.max(0, numValue)).toString() };
        }
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  // Use connected wallet address for payTo
  const useMyAddressForPayTo = () => {
    if (connectedAddress) {
      setPayTo(connectedAddress);
    }
  };

  // Use connected wallet address for a split
  const useMyAddress = (id: string) => {
    if (connectedAddress) {
      updateSplit(id, 'recipient', connectedAddress);
    }
  };

  // Convert splits to hookData format
  const getSplitsForPayment = () => {
    return splits
      .filter(s => s.recipient && parseInt(s.bips) > 0)
      .map(s => ({
        recipient: s.recipient as `0x${string}`,
        bips: parseInt(s.bips),
      }));
  };

  return (
    <ScenarioCard
      title="💸 Split Payment"
      badge="Serverless Mode"
      description={
        <>
          <p>
            Create custom payment splits using <code>TransferHook</code> distributed transfers.
            Add multiple recipients and define their share in basis points (1 bip = 0.01%).
          </p>

          {/* Mainnet Zero-Cost Highlight */}
          <div
            style={{
              marginTop: '15px',
              padding: '15px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '2px solid #86efac',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#15803d' }}>
              💰 Mainnet-Ready: Zero-Cost Demo
            </h4>
            <div style={{ fontSize: '14px', lineHeight: 1.8, color: '#166534' }}>
              <p style={{ margin: '0 0 8px 0' }}>
                <strong>💸 Funds Return:</strong> Set yourself as the primary recipient to get funds back
              </p>
              <p style={{ margin: '0 0 8px 0' }}>
                <strong>✨ You Get:</strong> Split distribution demonstrated + USDC back
              </p>
              <p style={{ margin: 0 }}>
                <strong>💵 Actual Cost:</strong> Only $0.01 facilitator fee
              </p>
            </div>
          </div>

          {/* Features */}
          <div
            style={{
              margin: '20px 0',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              borderLeft: '4px solid #667eea',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>✨ Features:</h4>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                💰 <strong>Flexible Distribution</strong>: Define multiple recipients with custom percentages
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                🎯 <strong>Remainder Handling</strong>: Primary recipient automatically gets remaining funds
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                ⚡ <strong>Atomic Execution</strong>: All transfers happen in one transaction
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                🔒 <strong>Built-in Hook</strong>: Uses TransferHook (no custom contract needed)
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                💸 <strong>Gas Efficient</strong>: Single transaction for multiple recipients
              </li>
            </ul>
          </div>

          {/* How It Works */}
          <div
            style={{
              margin: '20px 0',
              padding: '15px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1e40af' }}>💡 How it works:</h4>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.8', color: '#1e40af' }}>
              <li>Set primary recipient (receives remainder automatically)</li>
              <li>Add additional recipients with specific percentages (bips)</li>
              <li>Click Pay → Connect wallet → Sign authorization</li>
              <li>TransferHook distributes payment atomically to all recipients</li>
              <li>Set yourself as primary recipient to get funds back (only pay facilitator fee)</li>
            </ol>
          </div>

          {/* Technical Flow */}
          <CodeBlock
            code={splitPaymentCode}
            title="🔧 Technical Flow:"
            borderColor="#28a745"
          />

          {/* Split Configuration */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>
              📋 Payment Recipients:
            </h4>
            
            {/* Primary Recipient (payTo) */}
            <div
              style={{
                marginBottom: '15px',
                padding: '15px',
                backgroundColor: '#f0fdf4',
                borderRadius: '8px',
                border: '2px solid #86efac',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#15803d' }}>
                  Primary Recipient (receives remainder)
                </span>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px', color: '#666' }}>
                  Address:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={payTo}
                    onChange={(e) => setPayTo(e.target.value)}
                    placeholder="0x..."
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      fontSize: '13px',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                    }}
                  />
                  {connectedAddress && (
                    <button
                      onClick={useMyAddressForPayTo}
                      style={{
                        padding: '8px 12px',
                        fontSize: '12px',
                        color: '#15803d',
                        border: '1px solid #15803d',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Use My Address
                    </button>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#15803d', marginTop: '8px' }}>
                💰 Will receive: {(remainingBips / 100).toFixed(2)}% = ${(remainingBips * 0.01 / 100).toFixed(4)} USDC
              </div>
            </div>

            {/* Additional Recipients */}
            {splits.map((split, index) => (
              <div
                key={split.id}
                style={{
                  marginBottom: '15px',
                  padding: '15px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                border: '1px solid #e9ecef',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Additional Recipient #{index + 1}</span>
                <button
                  onClick={() => removeSplit(split.id)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    color: '#dc3545',
                    border: '1px solid #dc3545',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px', color: '#666' }}>
                    Address:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={split.recipient}
                      onChange={(e) => updateSplit(split.id, 'recipient', e.target.value)}
                      placeholder="0x..."
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        fontSize: '13px',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      }}
                    />
                    {connectedAddress && (
                      <button
                        onClick={() => useMyAddress(split.id)}
                        style={{
                          padding: '8px 12px',
                          fontSize: '12px',
                          color: '#3b82f6',
                          border: '1px solid #3b82f6',
                          borderRadius: '4px',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Use My Address
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px', color: '#666' }}>
                    Share (basis points, 10000 = 100%):
                  </label>
                  <input
                    type="number"
                    value={split.bips}
                    onChange={(e) => updateSplit(split.id, 'bips', e.target.value)}
                    placeholder="0-10000"
                    min="0"
                    max="10000"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                    }}
                  />
                  <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '3px' }}>
                    = {((parseInt(split.bips) || 0) / 100).toFixed(2)}% 
                    = ${((parseInt(split.bips) || 0) * 0.01 / 100).toFixed(4)} USDC
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addSplit}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                color: '#3b82f6',
                border: '2px dashed #3b82f6',
                borderRadius: '8px',
                backgroundColor: 'white',
                cursor: 'pointer',
                marginTop: '10px',
              }}
            >
              + Add Additional Recipient
            </button>
          </div>

          {/* Summary */}
          <div
            style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: totalBips > 10000 ? '#fee2e2' : '#f8f9fa',
              borderRadius: '8px',
              border: `1px solid ${totalBips > 10000 ? '#fecaca' : '#e9ecef'}`,
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
              📊 Split Summary:
            </h4>
            <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
              <div>
                <strong>Additional Recipients:</strong> {totalBips.toLocaleString()} bips ({(totalBips / 100).toFixed(2)}%)
              </div>
              <div>
                <strong>Primary Recipient (remainder):</strong> {remainingBips.toLocaleString()} bips ({(remainingBips / 100).toFixed(2)}%)
              </div>
              {totalBips > 10000 && (
                <div style={{ color: '#dc2626', marginTop: '8px', fontWeight: 'bold' }}>
                  ⚠️ Total exceeds 100%! Please adjust the splits.
                </div>
              )}
            </div>
          </div>
        </>
      }
    >
      {/* Payment Button */}
      <div style={{ marginTop: '20px' }}>
        <PaymentButton
          disabled={!isValid || isCompleted}
          onClick={() => {
            console.log('Split Payment button clicked!', { isValid, isCompleted, splits });
            reset();
            setShowPaymentDialog(true);
          }}
          isCompleted={isCompleted}
          idleLabel="💸 Pay $0.1 & Split"
          completedLabel="✅ Payment Split Complete!"
        />
      </div>

      {/* Error Message */}
      {error && <StatusMessage type="error" title="Payment Failed">{error}</StatusMessage>}

      {/* Success Result */}
      {isCompleted && paymentResult && (
        <TransactionResult
          txHash={paymentResult.txHash}
          network={paymentResult.network}
          details={[
            { label: 'Payment', value: <strong>$0.1 USDC</strong> },
            { label: 'Recipients', value: <strong>{getSplitsForPayment().length + 1} addresses</strong> },
            { 
              label: 'Splits', 
              value: (
                <div>
                  {/* Primary recipient */}
                  <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                    Primary: {payTo.slice(0, 6)}...{payTo.slice(-4)} ({(remainingBips / 100).toFixed(2)}%)
                  </div>
                  {/* Additional recipients */}
                  {getSplitsForPayment().map((s, i) => (
                    <div key={i} style={{ fontSize: '12px', marginBottom: '4px' }}>
                      #{i+1}: {s.recipient.slice(0, 6)}...{s.recipient.slice(-4)} ({(s.bips / 100).toFixed(2)}%)
                    </div>
                  ))}
                </div>
              )
            },
            { label: 'Hook', value: <code>TransferHook (distributed mode)</code> },
            { 
              label: 'Cost', 
              value: paymentResult.facilitatorFee 
                ? <strong>${(parseFloat(paymentResult.facilitatorFee) / 1_000_000).toFixed(4)} facilitator fee</strong>
                : <strong>$0.01 facilitator fee</strong>
            },
            { label: 'Mode', value: <strong>Serverless ⚡</strong> },
          ]}
        />
      )}

      {/* Payment Dialog */}
      <ServerlessPaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount={AMOUNT}
        recipient={payTo}
        splits={getSplitsForPayment()}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </ScenarioCard>
  );
}

