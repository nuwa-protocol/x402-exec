/**
 * Scenario 1: Referral Split
 * UI for 3-way payment split with optional referrer
 */

import { useState, useEffect } from 'react';
import { usePayment } from '../hooks/usePayment';
import { PaymentStatus } from '../components/PaymentStatus';
import { DebugPanel } from '../components/DebugPanel';

interface ReferralSplitProps {
  isConnected: boolean;
}

// Default addresses for testing
const DEFAULT_ADDRESSES = {
  merchant: '0x1111111111111111111111111111111111111111', // All 1s address
  platform: '0x2222222222222222222222222222222222222222', // All 2s address (testnet placeholder)
  referrerFallback: '0x1111111111111111111111111111111111111111', // All 1s address when no referrer
};

export function ReferralSplit({ isConnected }: ReferralSplitProps) {
  const [referrer, setReferrer] = useState('');
  const { status, error, result, debugInfo, pay, reset } = usePayment();

  // Read referrer from URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const referrerFromUrl = urlParams.get('referrer');
    if (referrerFromUrl) {
      setReferrer(referrerFromUrl);
    }
  }, []);

  const handlePay = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      await pay('/api/scenario-1/payment', { 
        referrer: referrer || DEFAULT_ADDRESSES.referrerFallback,
        merchantAddress: DEFAULT_ADDRESSES.merchant,
        platformAddress: DEFAULT_ADDRESSES.platform
      });
    } catch (err) {
      // Error handled by usePayment hook
    }
  };

  // Get the actual referrer address to display
  const actualReferrer = referrer || DEFAULT_ADDRESSES.referrerFallback;

  return (
    <div className="scenario-card">
      <div className="scenario-header">
        <h2>💰 Scenario 1: Referral Split</h2>
        <span className="badge">3-way Split</span>
      </div>

      <div className="scenario-description">
        <p>
          Pay <strong>$0.1 USDC</strong> and automatically split the payment among three parties:
        </p>
        <ul className="split-list">
          <li>
            <span className="percentage">70%</span> → Merchant
          </li>
          <li>
            <span className="percentage">20%</span> → Referrer (or fallback if not specified)
          </li>
          <li>
            <span className="percentage">10%</span> → Platform
          </li>
        </ul>
        
        <div className="split-details" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontSize: '14px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>💰 Payment Split Details:</h4>
          <div className="split-item" style={{ marginBottom: '8px', fontFamily: 'monospace' }}>
            <span style={{ fontWeight: 'bold', color: '#28a745' }}>70% → Merchant:</span>
            <br />
            <code style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
              {DEFAULT_ADDRESSES.merchant}
            </code>
          </div>
          <div className="split-item" style={{ marginBottom: '8px', fontFamily: 'monospace' }}>
            <span style={{ fontWeight: 'bold', color: '#007bff' }}>20% → Referrer:</span>
            <br />
            <code style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
              {actualReferrer}
            </code>
          </div>
          <div className="split-item" style={{ marginBottom: '8px', fontFamily: 'monospace' }}>
            <span style={{ fontWeight: 'bold', color: '#6c757d' }}>10% → Platform:</span>
            <br />
            <code style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
              {DEFAULT_ADDRESSES.platform}
            </code>
          </div>
        </div>
      </div>

      <div className="scenario-form">
        <div className="form-group">
          <label>Referrer Address (optional)</label>
          <input
            type="text"
            placeholder="0x... or leave empty for fallback address"
            value={referrer}
            onChange={(e) => setReferrer(e.target.value)}
            disabled={status === 'preparing' || status === 'paying'}
          />
          <span className="hint">Leave empty to use fallback address (0x111...111) as referrer. Can also be set via URL parameter ?referrer=0x...</span>
        </div>

        <button
          onClick={handlePay}
          disabled={!isConnected || status === 'preparing' || status === 'paying'}
          className="btn-pay"
        >
          {status === 'preparing' || status === 'paying' ? 'Processing...' : 'Pay $0.1 USDC'}
        </button>
      </div>

      <PaymentStatus
        status={status}
        error={error}
        successMessage="Payment split successfully among 3 parties!"
      />

      {/* Debug Panel - shows commitment parameters and calculation */}
      <DebugPanel debugInfo={debugInfo} />

      {status === 'success' && result?.settlement?.transaction && (
        <div className="success-details" style={{ marginTop: '20px', padding: '20px', backgroundColor: '#d4edda', borderRadius: '8px', border: '1px solid #c3e6cb' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#155724' }}>✅ Transaction Successful!</h4>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '14px', color: '#155724', marginBottom: '5px' }}>
              <strong>Transaction Hash:</strong>
            </div>
            <code style={{ 
              display: 'block', 
              backgroundColor: '#fff', 
              padding: '10px', 
              borderRadius: '4px', 
              fontSize: '12px',
              wordBreak: 'break-all',
              fontFamily: 'monospace'
            }}>
              {result.settlement.transaction}
            </code>
          </div>

          <a
            href={`https://sepolia.basescan.org/tx/${result.settlement.transaction}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
          >
            🔍 View on BaseScan →
          </a>
        </div>
      )}

      {status === 'success' && (
        <button onClick={reset} className="btn-secondary" style={{ marginTop: '15px' }}>
          Make Another Payment
        </button>
      )}
    </div>
  );
}

