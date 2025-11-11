/**
 * Serverless Points Reward Scenario
 * Pay-to-earn loyalty rewards using RewardHook in Serverless Mode
 * 
 * Mainnet Design: merchant = payer (funds return to user)
 * User only pays facilitator fee + gas
 */

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ServerlessPaymentDialog } from '../components/ServerlessPaymentDialog';
import { ScenarioCard } from '../components/ScenarioCard';
import { PaymentButton } from '../components/PaymentButton';
import { StatusMessage } from '../components/StatusMessage';
import { TransactionResult } from '../components/TransactionResult';
import { CodeBlock } from '../components/CodeBlock';
import { usePaymentFlow } from '../hooks/usePaymentFlow';
import pointsRewardCode from '../code-examples/points-reward.ts?raw';

const AMOUNT = '100000'; // 0.1 USDC (6 decimals)

export function ServerlessPointsReward() {
  const { address: connectedAddress } = useAccount();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { paymentResult, error, handleSuccess, handleError, reset, isCompleted } = usePaymentFlow();

  return (
    <ScenarioCard
      title="🎁 Pay & Earn Points"
      badge="Serverless Mode"
      description={
        <>
          <p>
            Pay <strong>$0.1 USDC</strong> and automatically receive 1000 reward points. Your USDC returns to your wallet!
          </p>

          {/* Mainnet Zero-Cost Highlight */}
          <div
            style={{
              margin: '20px 0',
              padding: '15px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '2px solid #86efac',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', color: '#15803d', fontSize: '15px' }}>
              💰 Mainnet-Ready: Zero-Cost Demo
            </h4>
            <div style={{ fontSize: '14px', lineHeight: 1.8, color: '#166534' }}>
              <p style={{ margin: '0 0 8px 0' }}>
                <strong>💸 Funds Return:</strong> The $0.1 USDC payment automatically returns to your wallet after reward distribution
              </p>
              <p style={{ margin: '0 0 8px 0' }}>
                <strong>✨ You Get:</strong> 1000 Reward Points + $0.1 USDC back
              </p>
              <p style={{ margin: 0 }}>
                <strong>💵 Actual Cost:</strong> Only $0.01 facilitator fee + gas
              </p>
            </div>
          </div>

          <div
            style={{
              margin: '20px 0',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              borderLeft: '4px solid #667eea',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>✨ Features:</h4>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                💰 <strong>Pay-to-Earn</strong>: Payment and reward distribution in one atomic transaction
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                🔄 <strong>Fund Circulation</strong>: merchant = payer, USDC returns to your wallet
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                🎁 <strong>Instant Rewards</strong>: Reward tokens sent immediately after payment
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                ⚡ <strong>Serverless</strong>: Direct client-to-facilitator execution
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                🔒 <strong>Atomic</strong>: Payment and reward succeed or fail together
              </li>
            </ul>
          </div>

          {/* How It Works */}
          <div
            style={{
              margin: '20px 0',
              padding: '15px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1e40af' }}>💡 How it works:</h4>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.8', color: '#1e40af' }}>
              <li>Click "Pay & Get Points" to initiate the payment</li>
              <li>Connect your wallet if not already connected</li>
              <li>Review and sign the payment authorization</li>
              <li>Facilitator processes payment + reward distribution atomically</li>
              <li>Points added to your balance, USDC returns to your wallet</li>
            </ol>
          </div>

          <CodeBlock
            code={pointsRewardCode}
            title="🔧 Technical Flow:"
            borderColor="#28a745"
          />
        </>
      }
    >
      {/* Payment Dialog - merchant will be set to payer dynamically */}
      <ServerlessPaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount={AMOUNT}
        recipient={connectedAddress || '0x0000000000000000000000000000000000000000'} // Will be updated on connect
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {/* Payment Button */}
      <PaymentButton
        onClick={() => setShowPaymentDialog(true)}
        isCompleted={isCompleted}
        idleLabel="🎁 Pay $0.1 & Get Points"
        completedLabel="✅ Points Earned & Funds Returned!"
      />

      {/* New Payment Button (shown after completion) */}
      {isCompleted && (
        <button
          onClick={() => {
            reset();
            setShowPaymentDialog(true);
          }}
          className="btn-secondary"
          style={{ marginTop: '10px' }}
        >
          Earn More Rewards
        </button>
      )}

      {/* Error Message */}
      {error && (
        <StatusMessage type="error" title="Reward Failed">
          <p style={{ margin: 0 }}>{error}</p>
        </StatusMessage>
      )}

      {/* Success Result */}
      {paymentResult && (
        <TransactionResult
          txHash={paymentResult.txHash}
          network={paymentResult.network}
          details={[
            { label: 'Payment', value: <strong>$0.1 USDC (returned to you)</strong> },
            { label: 'Rewards', value: <strong>1000 Points sent to you 🎁</strong> },
            { label: 'Hook', value: <code>RewardHook</code> },
            { 
              label: 'Cost', 
              value: paymentResult.facilitatorFee 
                ? <strong>${(parseFloat(paymentResult.facilitatorFee) / 1_000_000).toFixed(4)} facilitator fee</strong>
                : <strong>$0.01 facilitator fee</strong>
            },
            { label: 'Mode', value: <strong>Serverless ⚡</strong> },
          ]}
        />
      )}
    </ScenarioCard>
  );
}
