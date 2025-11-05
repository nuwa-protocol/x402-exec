/**
 * Scenario 2: Random NFT Mint
 * UI for NFT minting on payment
 */

import { useState, useEffect } from 'react';
import { PaymentDialog } from '../components/PaymentDialog';
import { PaymentStatus } from '../components/PaymentStatus';
import { buildApiUrl, Network, NETWORKS } from '../config';

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
  const [nftInfo, setNftInfo] = useState<NFTInfo | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch(buildApiUrl('/api/nft-minting/info'))
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

        {/* Network Stats Table */}
        {nftInfo?.networks && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 'bold' }}>
              NFT Collection Status Across Networks
            </h4>
            <div style={{ 
              overflowX: 'auto',
              border: '1px solid #e1e5e9',
              borderRadius: '8px',
              backgroundColor: 'white'
            }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      borderBottom: '1px solid #e1e5e9'
                    }}>
                      Network
                    </th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'center', 
                      fontWeight: '600',
                      borderBottom: '1px solid #e1e5e9'
                    }}>
                      Minted
                    </th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'center', 
                      fontWeight: '600',
                      borderBottom: '1px solid #e1e5e9'
                    }}>
                      Remaining
                    </th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'center', 
                      fontWeight: '600',
                      borderBottom: '1px solid #e1e5e9'
                    }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(nftInfo.networks).map(([network, networkData]) => {
                    const config = NETWORKS[network as Network];
                    const collection = networkData.collection;
                    const isAvailable = collection.remaining > 0;
                    
                    return (
                      <tr key={network} style={{ 
                        borderBottom: '1px solid #f1f3f4',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: isAvailable ? '#28a745' : '#dc3545'
                            }} />
                            {config?.displayName || network}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ fontFamily: 'monospace' }}>
                            {collection.currentSupply} / {collection.maxSupply}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ 
                            fontFamily: 'monospace',
                            fontWeight: '600',
                            color: isAvailable ? '#28a745' : '#dc3545'
                          }}>
                            {collection.remaining}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: isAvailable ? '#d4edda' : '#f8d7da',
                            color: isAvailable ? '#155724' : '#721c24'
                          }}>
                            {isAvailable ? 'Available' : 'Sold Out'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
          className="btn-pay"
        >
          Select Payment Method & Mint NFT ($0.1 USDC)
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
        endpoint="/api/nft-minting/payment"
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
