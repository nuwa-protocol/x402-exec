/**
 * Serverless Points Reward Scenario
 * Pay-to-earn loyalty rewards using RewardHook in Serverless Mode
 */

import { useState } from 'react';
import { ServerlessPaymentDialog } from '../components/ServerlessPaymentDialog';
import { ScenarioCard } from '../components/ScenarioCard';
import { PaymentButton } from '../components/PaymentButton';
import { StatusMessage } from '../components/StatusMessage';
import { TransactionResult } from '../components/TransactionResult';
import { usePaymentFlow } from '../hooks/usePaymentFlow';

const MERCHANT_ADDRESS = '0x1111111111111111111111111111111111111111';
const AMOUNT = '100000'; // 0.1 USDC (6 decimals)

export function ServerlessPointsReward() {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { paymentResult, error, handleSuccess, handleError, reset, isCompleted } = usePaymentFlow();

  return (
    <ScenarioCard
      title="⚡ Serverless Points Reward"
      badge="Serverless Mode"
      description={
        <>
          <p>
            Pay <strong>$0.1 USDC</strong> and automatically receive reward tokens after payment using a Serverless
            RewardHook.
          </p>

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
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>🔧 How it works:</h4>
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
                {`// 1. Get reward token and Hook addresses from env
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

// 🎁 Reward tokens automatically sent to payer!`}
              </code>
            </pre>
          </div>
        </>
      }
    >
      {/* Payment Dialog */}
      <ServerlessPaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount={AMOUNT}
        recipient={MERCHANT_ADDRESS}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {/* Payment Button */}
      <PaymentButton
        onClick={() => setShowPaymentDialog(true)}
        isCompleted={isCompleted}
        idleLabel="🎁 Pay $0.1 & Get Rewards"
        completedLabel="✅ Reward Received!"
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
            { label: 'Payment', value: <strong>$0.1 USDC</strong> },
            { label: 'Hook', value: <code>RewardHook</code> },
            { label: 'Status', value: <strong>Rewards Distributed 🎁</strong> },
            { label: 'Mode', value: <strong>Serverless ⚡</strong> },
          ]}
        />
      )}
    </ScenarioCard>
  );
}
