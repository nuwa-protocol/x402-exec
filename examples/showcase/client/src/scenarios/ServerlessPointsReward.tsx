import { useState } from 'react';
import { ServerlessPaymentDialog } from '../components/ServerlessPaymentDialog';
import { type Network, NETWORKS } from '../config';

export function ServerlessPointsReward() {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ txHash: string; network: Network } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePaymentSuccess = (result: { txHash: string; network: Network }) => {
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
        <h2>⚡ Serverless Points Reward</h2>
        <span className="badge badge-new">Serverless Mode</span>
      </div>

      <div className="scenario-description">
        <p>
          Pay <strong>$0.1 USDC</strong> and automatically receive reward tokens after payment using a Serverless RewardHook.
        </p>
        
        <div className="scenario-features">
          <h4>✨ Features:</h4>
          <ul>
            <li>💰 <strong>Pay-to-Earn</strong>: Payment and reward distribution in one atomic transaction</li>
            <li>🎁 <strong>Instant Rewards</strong>: Reward tokens sent immediately after payment</li>
            <li>⚡ <strong>Serverless</strong>: Direct client-to-facilitator execution</li>
            <li>🔒 <strong>Atomic</strong>: Payment and reward succeed or fail together</li>
          </ul>
        </div>

        <div className="code-example">
          <h4>🔧 How it works:</h4>
          <pre><code>{`// 1. Get reward token and Hook addresses from env
const rewardToken = RewardHook.getTokenAddress(network);
const hookAddress = RewardHook.getAddress(network);

// 2. Encode hookData with reward config
const hookData = RewardHook.encode({
  rewardToken,
  merchant: merchantAddress
});

// 3. Execute payment with reward hook
const result = await client.execute({
  hook: hookAddress,
  hookData,
  amount: '100000', // 0.1 USDC
  recipient: merchantAddress
});

// 🎁 Reward tokens automatically sent to payer!`}</code></pre>
        </div>
      </div>

      <ServerlessPaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount="100000" // 0.1 USDC (6 decimals)
        recipient="0x1111111111111111111111111111111111111111" // Placeholder merchant
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />

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
          {paymentResult ? '✅ Reward Received!' : '🎁 Pay $0.1 & Get Rewards'}
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
            Earn More Rewards
          </button>
        )}
      </div>

      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#fee', 
          borderRadius: '8px',
          border: '1px solid #fcc'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#c00' }}>❌ Reward Failed</h4>
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
          <h4 style={{ margin: '0 0 15px 0', color: '#155724' }}>✅ Reward Tokens Received!</h4>
          
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
            <div><strong>📊 Reward Details:</strong></div>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>Payment: <strong>$0.1 USDC</strong></li>
              <li>Network: <strong>{NETWORKS[paymentResult.network].name}</strong></li>
              <li>Hook: <code>RewardHook</code></li>
              <li>Status: <strong>Rewards Distributed</strong> 🎁</li>
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
        .scenario-features {
          margin: 20px 0;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }
        .scenario-features h4 {
          margin: 0 0 10px 0;
          color: #333;
        }
        .scenario-features ul {
          margin: 0;
          padding-left: 20px;
        }
        .scenario-features li {
          margin: 8px 0;
          line-height: 1.6;
        }
        .code-example {
          margin: 20px 0;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #28a745;
        }
        .code-example h4 {
          margin: 0 0 10px 0;
          color: #333;
        }
        .code-example pre {
          margin: 0;
          background-color: #282c34;
          padding: 15px;
          border-radius: 6px;
          overflow-x: auto;
        }
        .code-example code {
          color: #abb2bf;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}

