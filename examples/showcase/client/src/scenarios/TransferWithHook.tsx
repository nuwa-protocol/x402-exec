/**
 * Transfer with Hook Scenario
 * UI for basic x402x settlement using TransferHook with facilitator fee
 * Entry-level scenario demonstrating Hook architecture and facilitator incentives
 */

import { useState } from 'react';
import { PaymentDialog } from '../components/PaymentDialog';
import { PaymentStatus } from '../components/PaymentStatus';
import { DebugPanel } from '../components/DebugPanel';

interface TransferWithHookProps {}

export function TransferWithHook({}: TransferWithHookProps) {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>({});

  const handlePaymentSuccess = (result: any) => {
    setResult(result);
    setStatus('success');
    setShowPaymentDialog(false);
  };

  const handlePaymentError = (error: string) => {
    setError(error);
    setStatus('error');
    setShowPaymentDialog(false);
  };

  const reset = () => {
    setStatus('idle');
    setError('');
    setResult(null);
    setDebugInfo({});
  };

  return (
    <div className="scenario-card">
      <div className="scenario-header">
        <h2>🎣 Transfer with Hook</h2>
        <span className="badge">x402x Entry</span>
      </div>

      <div className="scenario-description">
        <p>
          Pay <strong>$0.11 USDC</strong> ($0.1 to merchant + $0.01 facilitator fee) using <code>TransferHook</code> - the simplest x402x settlement.
        </p>
        
        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#e8f9f0', borderRadius: '8px', border: '1px solid #b3e5d3' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0d9c4c' }}>🎯 What's Different from Direct Payment?</h4>
          <ul style={{ margin: '10px 0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li><strong>✅ SettlementRouter</strong> - Programmable settlement framework</li>
            <li><strong>✅ TransferHook</strong> - Built-in hook for simple transfers</li>
            <li><strong>✅ Facilitator Fee</strong> - Reward the facilitator ($0.01)</li>
            <li><strong>✅ Commitment Hash</strong> - Cryptographic parameter verification</li>
          </ul>
          <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#555' }}>
            💡 This is the entry point to x402x. Once you understand this, you can explore more complex scenarios like revenue split and NFT minting.
          </p>
        </div>

        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#fff9e6', borderRadius: '8px', border: '1px solid #ffe4a3' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#d97706' }}>🔧 How It Works</h4>
          <ol style={{ margin: '10px 0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li>Client signs payment authorization for <strong>$0.11 USDC</strong></li>
            <li>Facilitator submits to <code>SettlementRouter.settleAndExecute()</code></li>
            <li>Router deducts <strong>$0.01 facilitator fee</strong></li>
            <li>Router calls <code>TransferHook.execute()</code> with remaining <strong>$0.1</strong></li>
            <li>TransferHook transfers <strong>$0.1</strong> to merchant</li>
            <li>Facilitator claims accumulated fees later via <code>claimFees()</code></li>
          </ol>
        </div>
      </div>

      <div className="scenario-form">
        <button
          onClick={() => setShowPaymentDialog(true)}
          className="btn-pay"
        >
          Select Payment Method & Pay $0.11 USDC
        </button>
      </div>

      <PaymentStatus
        status={status}
        error={error}
        successMessage="Payment processed using TransferHook! Facilitator earned $0.01 fee."
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

          <div style={{ marginBottom: '15px', fontSize: '14px', lineHeight: '1.8' }}>
            <div><strong>📊 Settlement Summary:</strong></div>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>Merchant received: <strong>$0.1 USDC</strong></li>
              <li>Facilitator earned: <strong>$0.01 USDC</strong> (claimable)</li>
              <li>Hook used: <code>TransferHook</code></li>
              <li>Gas overhead: ~8k gas (~16% more than direct transfer)</li>
            </ul>
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
            🔍 View on Explorer →
          </a>
        </div>
      )}

      {status === 'success' && (
        <button onClick={reset} className="btn-secondary" style={{ marginTop: '15px' }}>
          Make Another Payment
        </button>
      )}

      {/* Payment Dialog */}
      <PaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount="0.11"
        currency="USDC"
        endpoint="/api/transfer-with-hook/payment"
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </div>
  );
}

