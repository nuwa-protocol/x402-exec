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
import { usePaymentFlow } from '../hooks/usePaymentFlow';

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

          <div
            style={{
              margin: '20px 0',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              borderLeft: '4px solid #28a745',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>🔧 Technical Flow:</h4>
            <pre
              style={{
                margin: 0,
                backgroundColor: '#282c34',
                padding: '15px',
                borderRadius: '6px',
                overflow: 'auto',
              }}
            >
              <code
                style={{
                  color: '#abb2bf',
                  fontFamily: "'Courier New', monospace",
                  fontSize: '13px',
                  lineHeight: 1.6,
                }}
              >
                {`// 1. User clicks Pay → Connect wallet → Get payer address
const payer = await getConnectedAddress();

// 2. Encode hookData with reward config (merchant = payer!)
const hookData = RewardHook.encode({
  rewardToken: rewardTokenAddress,
  merchant: payer // ← Key: Set merchant as payer
});

// 3. Execute payment with reward hook
const result = await client.execute({
  hook: rewardHookAddress,
  hookData,
  amount: '100000', // 0.1 USDC
});

// Result: Rewards sent to payer + USDC returned to payer`}
              </code>
            </pre>
          </div>
        </>
      }
    >
      {/* Payment Dialog - merchant will be set to payer dynamically */}
      <ServerlessPaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount={AMOUNT}
        recipient={connectedAddress || '0x0000000000000000000000000000000000000000'} // Will be updated on connect
        scenario="reward-points"
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
