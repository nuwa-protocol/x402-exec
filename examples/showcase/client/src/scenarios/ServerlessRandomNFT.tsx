import { useState } from 'react';
import { ServerlessPaymentDialog } from '../components/ServerlessPaymentDialog';
import { type Network, NETWORKS } from '../config';

export function ServerlessRandomNFT() {
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
        <h2>⚡ Serverless Random NFT</h2>
        <span className="badge badge-new">Serverless Mode</span>
      </div>

      <div className="scenario-description">
        <p>
          Pay <strong>$0.1 USDC</strong> and automatically mint a random NFT after payment using a Serverless NFTMintHook.
        </p>
        
        <div className="scenario-features">
          <h4>✨ Features:</h4>
          <ul>
            <li>💸 <strong>Pay-to-Mint</strong>: Payment and NFT minting in one atomic transaction</li>
            <li>🎲 <strong>Random Selection</strong>: Each mint gets a randomly selected NFT</li>
            <li>⚡ <strong>Serverless</strong>: Direct client-to-facilitator execution</li>
            <li>🔒 <strong>Atomic</strong>: Payment and mint succeed or fail together</li>
          </ul>
        </div>

        <div className="code-example">
          <h4>🔧 How it works:</h4>
          <pre><code>{`// 1. Get NFT contract and Hook addresses from env
const nftContract = NFTMintHook.getNFTContractAddress(network);
const hookAddress = NFTMintHook.getAddress(network);

// 2. Encode hookData with NFT config
const hookData = NFTMintHook.encode({
  nftContract,
  tokenId: 0n, // Random mint
  merchant: merchantAddress
});

// 3. Execute payment with NFT mint hook
const result = await client.execute({
  hook: hookAddress,
  hookData,
  amount: '100000', // 0.1 USDC
  recipient: merchantAddress
});`}</code></pre>
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
          {paymentResult ? '✅ NFT Minted!' : '🎨 Pay $0.1 & Mint NFT'}
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
            Mint Another NFT
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
          <h4 style={{ margin: '0 0 10px 0', color: '#c00' }}>❌ Minting Failed</h4>
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
          <h4 style={{ margin: '0 0 15px 0', color: '#155724' }}>✅ NFT Minted Successfully!</h4>
          
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
            <div><strong>📊 Mint Details:</strong></div>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>Payment: <strong>$0.1 USDC</strong></li>
              <li>Network: <strong>{NETWORKS[paymentResult.network].name}</strong></li>
              <li>Hook: <code>NFTMintHook</code></li>
              <li>Type: <strong>Random Mint</strong> 🎲</li>
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

