/**
 * Serverless Referral Split Scenario
 * Demonstrates 3-way payment split using TransferHook with distributed transfers
 */

import { useState, useEffect } from 'react';
import { ServerlessPaymentDialog } from '../components/ServerlessPaymentDialog';
import { ScenarioCard } from '../components/ScenarioCard';
import { PaymentButton } from '../components/PaymentButton';
import { StatusMessage } from '../components/StatusMessage';
import { TransactionResult } from '../components/TransactionResult';
import { usePaymentFlow } from '../hooks/usePaymentFlow';

// Default addresses for testing
const DEFAULT_ADDRESSES = {
  merchant: '0x1111111111111111111111111111111111111111', // All 1s address
  platform: '0x2222222222222222222222222222222222222222', // All 2s address
  referrerFallback: '0x1111111111111111111111111111111111111111', // All 1s when no referrer
};

const AMOUNT = '100000'; // 0.1 USDC (6 decimals)

export function ServerlessReferralSplit() {
  const [referrer, setReferrer] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { paymentResult, error, handleSuccess, handleError, reset, isCompleted } = usePaymentFlow();

  // Read referrer from URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const referrerFromUrl = urlParams.get('referrer');
    if (referrerFromUrl) {
      setReferrer(referrerFromUrl);
    }
  }, []);

  // Get the actual referrer address to display
  const actualReferrer = referrer || DEFAULT_ADDRESSES.referrerFallback;

  // Calculate splits based on 0.1 USDC (100000 atomic units)
  // 70% merchant, 20% referrer, 10% platform
  const splits = [
    { recipient: DEFAULT_ADDRESSES.merchant as `0x${string}`, bips: 7000 }, // 70%
    { recipient: actualReferrer as `0x${string}`, bips: 2000 }, // 20%
    { recipient: DEFAULT_ADDRESSES.platform as `0x${string}`, bips: 1000 }, // 10%
  ];

  return (
    <ScenarioCard
      title="💰 Referral Split"
      badge="Serverless Mode"
      description={
        <>
          <p>
            Pay <strong>$0.1 USDC</strong> and automatically split the payment among three parties using{' '}
            <code>TransferHook</code> with distributed transfers:
          </p>
          <ul className="split-list" style={{ listStyle: 'none', padding: 0, margin: '15px 0' }}>
            <li style={{ padding: '8px 0', display: 'flex', alignItems: 'center', fontSize: '14px' }}>
              <span style={{ display: 'inline-block', minWidth: '45px', fontWeight: 'bold', color: '#3b82f6' }}>
                70%
              </span>{' '}
              → Merchant (0.07 USDC)
            </li>
            <li style={{ padding: '8px 0', display: 'flex', alignItems: 'center', fontSize: '14px' }}>
              <span style={{ display: 'inline-block', minWidth: '45px', fontWeight: 'bold', color: '#3b82f6' }}>
                20%
              </span>{' '}
              → Referrer (0.02 USDC)
            </li>
            <li style={{ padding: '8px 0', display: 'flex', alignItems: 'center', fontSize: '14px' }}>
              <span style={{ display: 'inline-block', minWidth: '45px', fontWeight: 'bold', color: '#3b82f6' }}>
                10%
              </span>{' '}
              → Platform (0.01 USDC)
            </li>
          </ul>

          <div
            style={{
              marginTop: '15px',
              padding: '15px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1e40af' }}>💡 How it works:</h4>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.8', color: '#1e40af' }}>
              <li>User signs payment authorization for total amount</li>
              <li>
                Facilitator submits to <code>SettlementRouter</code>
              </li>
              <li>
                <code>TransferHook</code> splits payment by percentage (basis points)
              </li>
              <li>Each recipient receives their share atomically</li>
            </ol>
          </div>

          <div
            className="split-details"
            style={{
              marginTop: '15px',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>💰 Split Recipients:</h4>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontWeight: 'bold', color: '#28a745', marginBottom: '3px' }}>
                70% → Merchant (70,000 atomic units)
              </div>
              <code
                style={{
                  display: 'block',
                  backgroundColor: '#e9ecef',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}
              >
                {DEFAULT_ADDRESSES.merchant}
              </code>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontWeight: 'bold', color: '#007bff', marginBottom: '3px' }}>
                20% → Referrer (20,000 atomic units)
              </div>
              <code
                style={{
                  display: 'block',
                  backgroundColor: '#e9ecef',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}
              >
                {actualReferrer}
              </code>
            </div>

            <div style={{ marginBottom: '0' }}>
              <div style={{ fontWeight: 'bold', color: '#6c757d', marginBottom: '3px' }}>
                10% → Platform (10,000 atomic units)
              </div>
              <code
                style={{
                  display: 'block',
                  backgroundColor: '#e9ecef',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}
              >
                {DEFAULT_ADDRESSES.platform}
              </code>
            </div>
          </div>
        </>
      }
    >
      {/* Referrer Input */}
      <div className="form-group" style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
          Referrer Address (optional)
        </label>
        <input
          type="text"
          placeholder="0x... or leave empty for fallback address"
          value={referrer}
          onChange={(e) => setReferrer(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'monospace',
            marginBottom: '8px',
          }}
        />
        <span style={{ fontSize: '12px', color: '#666' }}>
          Leave empty to use fallback address. Can also be set via URL parameter ?referrer=0x...
        </span>
      </div>

      {/* Payment Dialog */}
      <ServerlessPaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount={AMOUNT}
        recipient={DEFAULT_ADDRESSES.merchant}
        splits={splits}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {/* Payment Button */}
      <PaymentButton
        onClick={() => setShowPaymentDialog(true)}
        isCompleted={isCompleted}
        idleLabel="💳 Pay $0.1 USDC (Split 3-Way)"
        completedLabel="✅ Payment Complete"
      />

      {/* New Payment Button (shown after completion) */}
      {isCompleted && (
        <button
          onClick={() => {
            reset();
            setShowPaymentDialog(true);
          }}
          className="btn-secondary"
          style={{ marginTop: '10px' }}
        >
          Make Another Payment
        </button>
      )}

      {/* Error Message */}
      {error && (
        <StatusMessage type="error" title="Payment Failed">
          <p style={{ margin: 0 }}>{error}</p>
        </StatusMessage>
      )}

      {/* Success Result */}
      {paymentResult && (
        <TransactionResult
          txHash={paymentResult.txHash}
          network={paymentResult.network}
          details={[
            { label: 'Total Amount', value: <strong>$0.1 USDC</strong> },
            { label: 'Hook', value: <code>TransferHook</code> (Distributed) },
            { label: 'Recipients', value: <strong>3 parties</strong> },
            { label: 'Mode', value: <strong>Serverless ⚡</strong> },
          ]}
        />
      )}
    </ScenarioCard>
  );
}
