/**
 * Serverless Points Reward Scenario
 * Pay-to-earn loyalty rewards using RewardHook in Serverless Mode
 * 
 * Mainnet Design: merchant = payer (funds return to user)
 * User only pays facilitator fee + gas
 */

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { encodeAbiParameters, type Address } from 'viem';
import { ServerlessPaymentDialog } from '../components/ServerlessPaymentDialog';
import { ScenarioCard } from '../components/ScenarioCard';
import { PaymentButton } from '../components/PaymentButton';
import { StatusMessage } from '../components/StatusMessage';
import { TransactionResult } from '../components/TransactionResult';
import { CodeBlock } from '../components/CodeBlock';
import { usePaymentFlow } from '../hooks/usePaymentFlow';
import { useAllNetworksRewardTokenData } from '../hooks/useRewardTokenData';
import { RewardHook } from '../hooks/RewardHook';
import { NETWORK_UI_CONFIG } from '../config';
import pointsRewardCode from '../code-examples/points-reward.ts?raw';

const AMOUNT = '100000'; // 0.1 USDC (6 decimals)

export function ServerlessPointsReward() {
  const { address: connectedAddress } = useAccount();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { paymentResult, error, handleSuccess, handleError, reset, isCompleted } = usePaymentFlow();
  
  // Read reward token data from all networks
  const allNetworksData = useAllNetworksRewardTokenData(connectedAddress);

  // Prepare hook and hookData for reward distribution
  const prepareRewardHook = () => {
    if (!connectedAddress) {
      return { hook: undefined, hookData: undefined };
    }

    // Get reward hook address (network-agnostic, will be resolved per network)
    const hook = RewardHook.getAddress('base-sepolia'); // Will be dynamically selected in dialog
    
    // Get reward token address from RewardHook
    const rewardToken = RewardHook.getTokenAddress('base-sepolia'); // Will be dynamically selected
    
    // Encode hookData: (rewardToken, merchant=payer to return funds)
    const hookData = encodeAbiParameters(
      [
        { name: 'rewardToken', type: 'address' },
        { name: 'merchant', type: 'address' }
      ],
      [
        rewardToken as Address,
        connectedAddress as Address // merchant = payer (funds return to user)
      ]
    );

    return { hook: hook as `0x${string}`, hookData: hookData as `0x${string}` };
  };

  const { hook, hookData } = prepareRewardHook();

  return (
    <ScenarioCard
      title="🎁 Pay & Earn Points"
      badge="Serverless Mode"
      description={
        <>
          <p>
            Pay <strong>$0.1 USDC</strong> and automatically receive 1000 reward points. Your USDC returns to your wallet!
          </p>

          {/* Reward Token Statistics Table */}
          <div
            style={{
              margin: '20px 0',
              padding: '15px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              border: '2px solid #fbbf24',
            }}
          >
            <h4 style={{ margin: '0 0 15px 0', color: '#92400e', fontSize: '15px' }}>
              🎁 Reward Token Statistics (Multi-Network)
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fde68a', borderBottom: '2px solid #fbbf24' }}>
                  <th style={{ padding: '10px', textAlign: 'left', color: '#78350f', fontWeight: 'bold' }}>Network</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#78350f', fontWeight: 'bold' }}>Your Balance</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#78350f', fontWeight: 'bold' }}>Pool Remaining</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#78350f', fontWeight: 'bold' }}>Total Supply</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#78350f', fontWeight: 'bold' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(allNetworksData).map(([network, data]) => {
                  const uiConfig = NETWORK_UI_CONFIG[network as keyof typeof NETWORK_UI_CONFIG];
                  return (
                    <tr key={network} style={{ borderBottom: '1px solid #fde68a' }}>
                      <td style={{ padding: '12px', color: '#78350f' }}>
                        <span style={{ marginRight: '6px' }}>{uiConfig.icon}</span>
                        <strong>{uiConfig.displayName}</strong>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#92400e', fontWeight: 'bold', fontSize: '16px' }}>
                        {data.loading ? '...' : data.error ? '-' : parseFloat(data.userBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#92400e', fontWeight: 'bold', fontSize: '16px' }}>
                        {data.loading ? '...' : data.error ? '-' : parseFloat(data.contractBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#15803d', fontWeight: 'bold', fontSize: '16px' }}>
                        {data.loading ? '...' : data.error ? '-' : parseFloat(data.totalSupply).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {data.loading ? (
                          <span style={{ color: '#78350f', fontSize: '12px' }}>Loading...</span>
                        ) : data.error ? (
                          <span style={{ color: '#dc2626', fontSize: '12px' }}>⚠️ {data.error}</span>
                        ) : (
                          <span style={{ color: '#15803d', fontSize: '12px' }}>✓ Active</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
      {/* Payment Dialog - use reward hook */}
      <ServerlessPaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount={AMOUNT}
        recipient={connectedAddress || '0x0000000000000000000000000000000000000000'}
        hook={hook}
        hookData={hookData}
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
