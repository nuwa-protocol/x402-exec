/**
 * Simple Direct Payment Scenario
 * UI for direct payment to resource server using original x402 protocol
 * No router, no hook, no complex settlement logic - for debugging and comparison
 */

import { usePayment } from '../hooks/usePayment';
import { PaymentStatus } from '../components/PaymentStatus';
import { DebugPanel } from '../components/DebugPanel';

interface DirectPaymentProps {
  isConnected: boolean;
}

export function DirectPayment({ isConnected }: DirectPaymentProps) {
  const { status, error, result, debugInfo, pay, reset } = usePayment();

  const handlePay = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      await pay('/api/direct-payment/payment', {});
    } catch (err) {
      // Error handled by usePayment hook
    }
  };

  return (
    <div className="scenario-card">
      <div className="scenario-header">
        <h2>💳 Simple Direct Payment</h2>
        <span className="badge">Original x402</span>
      </div>

      <div className="scenario-description">
        <p>
          Pay <strong>$0.1 USDC</strong> directly to the resource server using the original x402 protocol.
        </p>
        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#e8f4fd', borderRadius: '8px', border: '1px solid #b3d9f7' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0066cc' }}>🔍 Purpose: Debugging & Comparison</h4>
          <ul style={{ margin: '10px 0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li><strong>No SettlementRouter</strong> - bypasses complex settlement logic</li>
            <li><strong>No Hook</strong> - no on-chain execution or distribution</li>
            <li><strong>No Commitment</strong> - uses simple random nonce</li>
            <li><strong>Direct Transfer</strong> - USDC goes straight to resource server</li>
          </ul>
          <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#555' }}>
            💡 Use this scenario to isolate issues: if this works but others fail, the problem is in the router/hook layer.
          </p>
        </div>
      </div>

      <div className="scenario-form">
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
        successMessage="Payment sent successfully to resource server!"
      />

      {/* Debug Panel - shows payment flow details */}
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

