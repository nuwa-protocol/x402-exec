/**
 * Scenario 2: Random NFT Mint
 * UI for NFT minting on payment
 */

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { PaymentDialog } from '../components/PaymentDialog';
import { PaymentStatus } from '../components/PaymentStatus';
import { buildApiUrl, Network, NETWORKS, getPreferredNetwork } from '../config';

interface RandomNFTProps {}

interface NFTInfo {
  networks: Record<Network, {
    collection: {
      name: string;
      symbol: string;
      maxSupply: number;
      currentSupply: number;
      remaining: number;
    };
  }>;
  // Legacy format for backward compatibility
  collection: {
    name: string;
    symbol: string;
    maxSupply: number;
    currentSupply: number;
    remaining: number;
  };
}

export function RandomNFT({}: RandomNFTProps) {
  const { address } = useAccount();
  const [nftInfo, setNftInfo] = useState<NFTInfo | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(() => getPreferredNetwork() || 'base-sepolia');

  useEffect(() => {
    fetch(buildApiUrl('/api/scenario-2/info'))
      .then((res) => res.json())
      .then((data) => setNftInfo(data))
      .catch(console.error);
  }, [status]); // Refresh after successful payment

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
  };

  const tokenId = result?.payment?.extra?.nftTokenId;
  
  // Get current network's collection info
  const currentCollection = nftInfo?.networks?.[selectedNetwork]?.collection || nftInfo?.collection;

  return (
    <div className="scenario-card">
      <div className="scenario-header">
        <h2>🎨 Scenario 2: Random NFT Mint</h2>
        <span className="badge">Sequential Minting</span>
      </div>

      <div className="scenario-description">
        <p>
          Pay <strong>$0.1 USDC</strong> and instantly receive a Random NFT in your wallet!
        </p>

        {/* Network Selector */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
            View Network Stats:
          </label>
          <select
            value={selectedNetwork}
            onChange={(e) => setSelectedNetwork(e.target.value as Network)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '14px',
              backgroundColor: 'white',
              cursor: 'pointer',
            }}
          >
            {Object.entries(NETWORKS).map(([network, config]) => (
              <option key={network} value={network}>
                {config.displayName}
              </option>
            ))}
          </select>
        </div>

        {currentCollection && (
          <div className="nft-stats">
            <div className="stat">
              <span className="stat-label">Collection</span>
              <span className="stat-value">{currentCollection.name}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Minted on {NETWORKS[selectedNetwork].displayName}</span>
              <span className="stat-value">
                {currentCollection.currentSupply} / {currentCollection.maxSupply}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Remaining</span>
              <span className="stat-value">{currentCollection.remaining}</span>
            </div>
          </div>
        )}
      </div>

      <div className="scenario-form">
        <div className="nft-preview">
          <div className="nft-placeholder">
            <span className="nft-icon">🎭</span>
            <p>Random NFT</p>
            {tokenId !== undefined && <p className="token-id">#{tokenId}</p>}
          </div>
        </div>

        <button
          onClick={() => setShowPaymentDialog(true)}
          disabled={currentCollection?.remaining === 0}
          className="btn-pay"
        >
          {currentCollection?.remaining === 0
            ? `Sold Out on ${NETWORKS[selectedNetwork].displayName}`
            : 'Select Payment Method & Mint NFT ($0.1 USDC)'}
        </button>
      </div>

      <PaymentStatus
        status={status}
        error={error}
        successMessage={`NFT #${tokenId} minted to your wallet!`}
      />

      {status === 'success' && result?.settlement?.transaction && (
        <div className="success-details" style={{ marginTop: '20px', padding: '20px', backgroundColor: '#d4edda', borderRadius: '8px', border: '1px solid #c3e6cb' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#155724' }}>✅ NFT Minted Successfully!</h4>
          
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
            🔍 View on Explorer →
          </a>
        </div>
      )}

      {status === 'success' && (
        <div className="success-actions">
          <p className="hint">Check your wallet to see your new NFT!</p>
          <button onClick={reset} className="btn-secondary" style={{ marginTop: '15px' }}>
            Mint Another NFT
          </button>
        </div>
      )}

      {/* Payment Dialog */}
      <PaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount="0.1"
        currency="USDC"
        endpoint="/api/scenario-2/payment"
        getRequestBody={(walletAddress) => ({
          recipient: walletAddress, // NFT will be minted to the connected wallet
          merchantAddress: '0x1111111111111111111111111111111111111111' // Default merchant address
        })}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </div>
  );
}
