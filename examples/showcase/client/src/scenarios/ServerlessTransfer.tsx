/**
 * Serverless Transfer Scenario
 * Simple x402x settlement using TransferHook in Serverless Mode
 * 
 * This demonstrates the simplest x402x payment flow:
 * - No backend server needed
 * - Direct facilitator interaction
 * - Automatic fee calculation
 */

import { useState } from 'react';
import { ServerlessPaymentDialog } from '../components/ServerlessPaymentDialog';
import { type Network, NETWORKS } from '../config';

export function ServerlessTransfer() {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ txHash: string; network: Network } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePaymentSuccess = (result: { txHash: string; network: Network }) => {
    console.log('[ServerlessTransfer] Payment success:', result);
    console.log('[ServerlessTransfer] Network:', result.network);
    console.log('[ServerlessTransfer] Explorer URL:', NETWORKS[result.network].explorerUrl);
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

  return (
    <div className="scenario-card">
      <div className="scenario-header">
        <h2>⚡ Serverless Transfer</h2>
        <span className="badge badge-new">Serverless Mode</span>
      </div>

      <div className="scenario-description">
        <p>
          Pay <strong>$0.1 USDC</strong> + dynamic facilitator fee using <code>TransferHook</code> in <strong>Serverless Mode</strong>.
        </p>
        
        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#e8f9f0', borderRadius: '8px', border: '1px solid #b3e5d3' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0d9c4c' }}>⚡ What is Serverless Mode?</h4>
          <ul style={{ margin: '10px 0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li><strong>✅ No Backend</strong> - Client directly calls facilitator</li>
            <li><strong>✅ Zero Infrastructure</strong> - No servers to maintain</li>
            <li><strong>✅ 3 Lines of Code</strong> - Ultra-simple integration</li>
            <li><strong>✅ Auto Fee Calculation</strong> - SDK queries facilitator for optimal fee</li>
            <li><strong>✅ Type-Safe API</strong> - Full TypeScript support</li>
          </ul>
        </div>

        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#fff9e6', borderRadius: '8px', border: '1px solid #ffe4a3' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#d97706' }}>🔧 How It Works</h4>
          <ol style={{ margin: '10px 0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li>Client SDK queries facilitator for recommended fee</li>
            <li>Client prepares settlement parameters and calculates commitment hash</li>
            <li>User signs EIP-3009 authorization for <strong>$0.1 + fee</strong></li>
            <li>Client submits signed authorization to facilitator</li>
            <li>Facilitator calls <code>SettlementRouter.settleAndExecute()</code></li>
            <li>Router deducts facilitator fee and executes <code>TransferHook</code></li>
            <li>Merchant receives <strong>$0.1 USDC</strong></li>
          </ol>
          <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#555' }}>
            💡 All complexity is handled by <code>@x402x/client</code> SDK!
          </p>
        </div>

        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0f4ff', borderRadius: '8px', border: '1px solid #c7d7fe' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#1e40af' }}>💻 Code Example</h4>
          <pre style={{ 
            backgroundColor: '#1e293b', 
            color: '#e2e8f0', 
            padding: '15px', 
            borderRadius: '6px', 
            overflow: 'auto',
            fontSize: '12px',
            lineHeight: '1.6'
          }}>
{`import { useX402Client } from '@x402x/client';
import { TransferHook } from '@x402x/core';

const client = useX402Client();

await client.execute({
  hook: TransferHook.getAddress('base-sepolia'),
  hookData: TransferHook.encode(),
  amount: '100000', // 0.1 USDC
  recipient: '0x...'
});`}
          </pre>
        </div>
      </div>

      {/* Serverless Payment Dialog */}
      <ServerlessPaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount="100000" // 0.1 USDC (6 decimals)
        recipient="0x742d35cc6634c0532925a3b844bc9e7595f0beb1"
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />

      {/* Payment Button */}
      <div className="scenario-form">
        <button
          onClick={() => setShowPaymentDialog(true)}
          disabled={!!paymentResult}
          className="btn-pay"
          style={{
            opacity: paymentResult ? 0.6 : 1,
            cursor: paymentResult ? 'not-allowed' : 'pointer'
          }}
        >
          {paymentResult ? '✅ Payment Complete' : '💳 Pay $0.1 USDC'}
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
          <h4 style={{ margin: '0 0 15px 0', color: '#155724' }}>✅ Payment Successful!</h4>
          
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
              <li>Amount: <strong>$0.1 USDC</strong></li>
              <li>Network: <strong>{NETWORKS[paymentResult.network].name}</strong></li>
              <li>Hook: <code>TransferHook</code></li>
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
      `}</style>
    </div>
  );
}

