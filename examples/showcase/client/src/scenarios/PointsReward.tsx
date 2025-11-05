/**
 * Scenario 3: Points Reward
 * UI for reward token distribution
 */

import { useState, useEffect } from 'react';
import { PaymentDialog } from '../components/PaymentDialog';
import { PaymentStatus } from '../components/PaymentStatus';
import { buildApiUrl, Network, NETWORKS } from '../config';

interface PointsRewardProps {}

interface RewardInfo {
  networks: Record<Network, {
    reward: {
      token: string;
      symbol: string;
      amountPerPayment: string;
      totalSupply: string;
      remaining: string;
    };
  }>;
  // Legacy format for backward compatibility
  reward: {
    token: string;
    symbol: string;
    amountPerPayment: string;
    totalSupply: string;
    remaining: string;
  };
}

export function PointsReward({}: PointsRewardProps) {
  const [rewardInfo, setRewardInfo] = useState<RewardInfo | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch(buildApiUrl('/api/reward-points/info'))
      .then((res) => res.json())
      .then((data) => setRewardInfo(data))
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


  return (
    <div className="scenario-card">
      <div className="scenario-header">
        <h2>🎁 Scenario 3: Points Reward</h2>
        <span className="badge">Token Distribution</span>
      </div>

      <div className="scenario-description">
        <p>
          Pay <strong>$0.1 USDC</strong> and instantly receive <strong>1000 Reward Points</strong>!
        </p>

        {/* Points per Payment Info */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          padding: '16px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px', 
          marginBottom: '20px' 
        }}>
          <span style={{ fontSize: '24px' }}>🏆</span>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
              1000 Points
            </div>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>
              Earned per payment
            </div>
          </div>
        </div>

        {/* Network Rewards Table */}
        {rewardInfo?.networks && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 'bold' }}>
              Reward Points Status Across Networks
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
                      Total Supply
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
                  {Object.entries(rewardInfo.networks).map(([network, networkData]) => {
                    const config = NETWORKS[network as Network];
                    const reward = networkData.reward;
                    const remaining = parseFloat(reward.remaining);
                    const isAvailable = remaining >= 1000; // Need at least 1000 points for one payment
                    
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
                            {parseFloat(reward.totalSupply).toLocaleString()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ 
                            fontFamily: 'monospace',
                            fontWeight: '600',
                            color: isAvailable ? '#28a745' : '#dc3545'
                          }}>
                            {remaining.toLocaleString()}
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
                            {isAvailable ? 'Available' : 'Depleted'}
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
        <div className="reward-preview">
          <div className="points-display">
            <span className="points-icon">💎</span>
            <div className="points-amount">+1000</div>
            <div className="points-label">POINTS</div>
          </div>
        </div>

        <button
          onClick={() => setShowPaymentDialog(true)}
          className="btn-pay"
        >
          Select Payment Method & Earn Points ($0.1 USDC)
        </button>
      </div>

      <PaymentStatus
        status={status}
        error={error}
        successMessage="1000 reward points credited to your wallet!"
      />

      {status === 'success' && result?.settlement?.transaction && (
        <div className="success-details" style={{ marginTop: '20px', padding: '20px', backgroundColor: '#d4edda', borderRadius: '8px', border: '1px solid #c3e6cb' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#155724' }}>✅ Points Earned Successfully!</h4>
          
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
          <p className="hint">Check your wallet to see your reward tokens!</p>
          <button onClick={reset} className="btn-secondary" style={{ marginTop: '15px' }}>
            Earn More Points
          </button>
        </div>
      )}

      {/* Payment Dialog */}
      <PaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount="0.1"
        currency="USDC"
        endpoint="/api/reward-points/payment"
        requestBody={{
          merchantAddress: '0x1111111111111111111111111111111111111111' // Default merchant address
        }}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </div>
  );
}
