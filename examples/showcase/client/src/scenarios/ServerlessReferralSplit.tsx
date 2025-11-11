/**
 * Serverless Referral Split Scenario
 * Demonstrates 3-way payment split using TransferHook with distributed transfers
 */

import { useState, useEffect } from 'react';
import { ServerlessPaymentDialog } from '../components/ServerlessPaymentDialog';
import { type Network, NETWORKS } from '../config';

// Default addresses for testing
const DEFAULT_ADDRESSES = {
  merchant: '0x1111111111111111111111111111111111111111', // All 1s address
  platform: '0x2222222222222222222222222222222222222222', // All 2s address
  referrerFallback: '0x1111111111111111111111111111111111111111', // All 1s when no referrer
};

export function ServerlessReferralSplit() {
  const [referrer, setReferrer] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ txHash: string; network: Network } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read referrer from URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const referrerFromUrl = urlParams.get('referrer');
    if (referrerFromUrl) {
      setReferrer(referrerFromUrl);
    }
  }, []);

  const handlePaymentSuccess = (result: { txHash: string; network: Network }) => {
    console.log('[ServerlessReferralSplit] Payment success:', result);
    setPaymentResult(result);
    setError(null);
  };

  const handlePaymentError = (err: string) => {
    setError(err);
  };

  const handleReset = () => {
    setPaymentResult(null);
    setError(null);
  };

  // Get the actual referrer address to display
  const actualReferrer = referrer || DEFAULT_ADDRESSES.referrerFallback;

  // Calculate splits based on 0.1 USDC (100000 atomic units)
  // 70% merchant, 20% referrer, 10% platform
  const splits = [
    { recipient: DEFAULT_ADDRESSES.merchant as `0x${string}`, bips: 7000 }, // 70%
    { recipient: actualReferrer as `0x${string}`, bips: 2000 },             // 20%
    { recipient: DEFAULT_ADDRESSES.platform as `0x${string}`, bips: 1000 }, // 10%
  ];

  return (
    <div className="scenario-card">
      <div className="scenario-header">
        <h2>💰 Referral Split</h2>
        <span className="badge badge-new">Serverless Mode</span>
      </div>

      <div className="scenario-description">
        <p>
          Pay <strong>$0.1 USDC</strong> and automatically split the payment among three parties using{' '}
          <code>TransferHook</code> with distributed transfers:
        </p>
        <ul className="split-list">
          <li>
            <span className="percentage">70%</span> → Merchant (0.07 USDC)
          </li>
          <li>
            <span className="percentage">20%</span> → Referrer (0.02 USDC)
          </li>
          <li>
            <span className="percentage">10%</span> → Platform (0.01 USDC)
          </li>
        </ul>
        
        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1e40af' }}>
            💡 How it works:
          </h4>
          <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.8', color: '#1e40af' }}>
            <li>User signs payment authorization for total amount</li>
            <li>Facilitator submits to <code>SettlementRouter</code></li>
            <li><code>TransferHook</code> splits payment by percentage (basis points)</li>
            <li>Each recipient receives their share atomically</li>
          </ol>
        </div>

        <div className="split-details" style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontSize: '13px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>💰 Split Recipients:</h4>
          
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontWeight: 'bold', color: '#28a745', marginBottom: '3px' }}>
              70% → Merchant (70,000 atomic units)
            </div>
            <code style={{ 
              display: 'block', 
              backgroundColor: '#e9ecef', 
              padding: '6px 8px', 
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              wordBreak: 'break-all'
            }}>
              {DEFAULT_ADDRESSES.merchant}
            </code>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontWeight: 'bold', color: '#007bff', marginBottom: '3px' }}>
              20% → Referrer (20,000 atomic units)
            </div>
            <code style={{ 
              display: 'block', 
              backgroundColor: '#e9ecef', 
              padding: '6px 8px', 
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              wordBreak: 'break-all'
            }}>
              {actualReferrer}
            </code>
          </div>

          <div style={{ marginBottom: '0' }}>
            <div style={{ fontWeight: 'bold', color: '#6c757d', marginBottom: '3px' }}>
              10% → Platform (10,000 atomic units)
            </div>
            <code style={{ 
              display: 'block', 
              backgroundColor: '#e9ecef', 
              padding: '6px 8px', 
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              wordBreak: 'break-all'
            }}>
              {DEFAULT_ADDRESSES.platform}
            </code>
          </div>
        </div>
      </div>

      <div className="scenario-form">
        <div className="form-group">
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
              marginBottom: '8px'
            }}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>
            Leave empty to use fallback address. Can also be set via URL parameter ?referrer=0x...
          </span>
        </div>

        <button
          onClick={() => setShowPaymentDialog(true)}
          disabled={!!paymentResult}
          className="btn-pay"
          style={{
            opacity: paymentResult ? 0.6 : 1,
            cursor: paymentResult ? 'not-allowed' : 'pointer',
            marginTop: '10px'
          }}
        >
          {paymentResult ? '✅ Payment Complete' : '💳 Pay $0.1 USDC (Split 3-Way)'}
        </button>

        {paymentResult && (
          <button
            onClick={() => {
              handleReset();
              setShowPaymentDialog(true);
            }}
            className="btn-secondary"
            style={{ marginTop: '10px' }}
          >
            Make Another Payment
          </button>
        )}
      </div>

      {/* Serverless Payment Dialog with custom splits */}
      <ServerlessPaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount="100000" // 0.1 USDC (6 decimals)
        recipient={DEFAULT_ADDRESSES.merchant} // Fallback recipient (not used with splits)
        splits={splits} // Pass splits for distributed transfer
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />

      {/* Status Messages */}
      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#fee', 
          borderRadius: '8px',
          border: '1px solid #fcc'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#c00' }}>❌ Payment Failed</h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#600' }}>{error}</p>
        </div>
      )}

      {paymentResult && (
        <div style={{ 
          marginTop: '20px', 
          padding: '20px', 
          backgroundColor: '#d4edda', 
          borderRadius: '8px',
          border: '1px solid #c3e6cb'
        }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#155724' }}>✅ Payment Split Successfully!</h4>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '14px', color: '#155724', marginBottom: '5px', fontWeight: 'bold' }}>
              Transaction Hash:
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
              {paymentResult.txHash}
            </code>
          </div>

          <div style={{ marginBottom: '15px', fontSize: '14px', lineHeight: '1.8' }}>
            <div><strong>📊 Settlement Details:</strong></div>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>Total Amount: <strong>$0.1 USDC</strong></li>
              <li>Network: <strong>{NETWORKS[paymentResult.network].name}</strong></li>
              <li>Hook: <code>TransferHook</code> (Distributed)</li>
              <li>Recipients: <strong>3 parties</strong></li>
              <li>Mode: <strong>Serverless</strong> ⚡</li>
            </ul>
          </div>

          <a
            href={`${NETWORKS[paymentResult.network].explorerUrl}/tx/${paymentResult.txHash}`}
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
            🔍 View on Explorer →
          </a>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .badge-new {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .split-list {
          list-style: none;
          padding: 0;
          margin: 15px 0;
        }
        .split-list li {
          padding: 8px 0;
          display: flex;
          align-items: center;
          font-size: 14px;
        }
        .percentage {
          display: inline-block;
          min-width: 45px;
          font-weight: bold;
          color: #3b82f6;
        }
      `}</style>
    </div>
  );
}

