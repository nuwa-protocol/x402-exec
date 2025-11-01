/**
 * Scenario 3: Points Reward
 * UI for reward token distribution
 */

import { useState, useEffect } from 'react';
import { usePayment } from '../hooks/usePayment';
import { PaymentStatus } from '../components/PaymentStatus';

interface PointsRewardProps {
  isConnected: boolean;
}

interface RewardInfo {
  reward: {
    token: string;
    symbol: string;
    amountPerPayment: string;
    totalSupply: string;
    remaining: string;
  };
}

export function PointsReward({ isConnected }: PointsRewardProps) {
  const [rewardInfo, setRewardInfo] = useState<RewardInfo | null>(null);
  const { status, error, result, pay, reset } = usePayment();

  useEffect(() => {
    fetch('/api/scenario-3/info')
      .then((res) => res.json())
      .then((data) => setRewardInfo(data))
      .catch(console.error);
  }, [status]); // Refresh after successful payment

  const handlePay = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      await pay('/api/scenario-3/payment', {
        merchantAddress: '0x1111111111111111111111111111111111111111' // Default merchant address
      });
    } catch (err) {
      // Error handled by usePayment hook
    }
  };

  const remainingPoints = rewardInfo ? parseFloat(rewardInfo.reward.remaining) : 0;

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

        {rewardInfo && (
          <div className="reward-stats">
            <div className="stat-large">
              <span className="reward-icon">🏆</span>
              <div>
                <div className="stat-value-large">{rewardInfo.reward.amountPerPayment}</div>
                <div className="stat-label">Points per Payment</div>
              </div>
            </div>

            <div className="stats-row">
              <div className="stat">
                <span className="stat-label">Total Supply</span>
                <span className="stat-value">
                  {parseFloat(rewardInfo.reward.totalSupply).toLocaleString()}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Remaining</span>
                <span className="stat-value">
                  {remainingPoints.toLocaleString()}
                </span>
              </div>
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
          onClick={handlePay}
          disabled={
            !isConnected ||
            status === 'preparing' ||
            status === 'paying' ||
            remainingPoints < 1000
          }
          className="btn-pay"
        >
          {remainingPoints < 1000
            ? 'Rewards Depleted'
            : status === 'preparing' || status === 'paying'
            ? 'Processing...'
            : 'Earn 1000 Points for $0.1 USDC'}
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
            🔍 View on BaseScan →
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
    </div>
  );
}

