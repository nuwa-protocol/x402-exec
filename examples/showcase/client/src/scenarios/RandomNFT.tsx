/**
 * Scenario 2: Random NFT Mint
 * UI for NFT minting on payment
 */

import { useState, useEffect } from 'react';
import { usePayment } from '../hooks/usePayment';
import { PaymentStatus } from '../components/PaymentStatus';

interface RandomNFTProps {
  isConnected: boolean;
  walletAddress: string;
}

interface NFTInfo {
  collection: {
    name: string;
    symbol: string;
    maxSupply: number;
    currentSupply: number;
    remaining: number;
  };
}

export function RandomNFT({ isConnected, walletAddress }: RandomNFTProps) {
  const [nftInfo, setNftInfo] = useState<NFTInfo | null>(null);
  const { status, error, pay, reset, result } = usePayment();

  useEffect(() => {
    fetch('/api/scenario-2/info')
      .then((res) => res.json())
      .then((data) => setNftInfo(data))
      .catch(console.error);
  }, [status]); // Refresh after successful payment

  const handlePay = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      await pay('/api/scenario-2/payment', { 
        recipient: walletAddress,
        merchantAddress: '0x1111111111111111111111111111111111111111' // Default merchant address
      });
    } catch (err) {
      // Error handled by usePayment hook
    }
  };

  const tokenId = result?.payment?.extra?.nftTokenId;

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

        {nftInfo && (
          <div className="nft-stats">
            <div className="stat">
              <span className="stat-label">Collection</span>
              <span className="stat-value">{nftInfo.collection.name}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Minted</span>
              <span className="stat-value">
                {nftInfo.collection.currentSupply} / {nftInfo.collection.maxSupply}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Remaining</span>
              <span className="stat-value">{nftInfo.collection.remaining}</span>
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
          onClick={handlePay}
          disabled={
            !isConnected ||
            status === 'preparing' ||
            status === 'paying' ||
            (nftInfo?.collection.remaining === 0)
          }
          className="btn-pay"
        >
          {nftInfo?.collection.remaining === 0
            ? 'Sold Out'
            : status === 'preparing' || status === 'paying'
            ? 'Minting...'
            : 'Mint NFT for $0.1 USDC'}
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
            🔍 View on BaseScan →
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
    </div>
  );
}

