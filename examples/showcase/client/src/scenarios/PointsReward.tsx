/**
 * Scenario 3: Points Reward
 * UI for reward token distribution
 */

import { useState, useEffect } from 'react';
import { PaymentDialog } from '../components/PaymentDialog';
import { PaymentStatus } from '../components/PaymentStatus';
import { buildApiUrl, Network } from '../config';

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
    fetch(buildApiUrl('/api/scenario-3/info'))
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
          onClick={() => setShowPaymentDialog(true)}
          disabled={remainingPoints < 1000}
          className="btn-pay"
        >
          {remainingPoints < 1000
            ? 'Rewards Depleted'
            : 'Select Payment Method & Earn Points ($0.1 USDC)'}
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
        endpoint="/api/scenario-3/payment"
        requestBody={{
          merchantAddress: '0x1111111111111111111111111111111111111111' // Default merchant address
        }}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </div>
  );
}
