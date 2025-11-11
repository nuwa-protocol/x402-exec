/**
 * Serverless Transfer Scenario
 * Simple x402x settlement using TransferHook in Serverless Mode
 * 
 * This demonstrates the simplest x402x payment flow:
 * - No backend server needed
 * - Direct facilitator interaction
 * - Automatic fee calculation
 */

import { useState } from 'react';
import { ServerlessPaymentDialog } from '../components/ServerlessPaymentDialog';
import { ScenarioCard } from '../components/ScenarioCard';
import { PaymentButton } from '../components/PaymentButton';
import { StatusMessage } from '../components/StatusMessage';
import { TransactionResult } from '../components/TransactionResult';
import { usePaymentFlow } from '../hooks/usePaymentFlow';

const MERCHANT_ADDRESS = '0x742d35cc6634c0532925a3b844bc9e7595f0beb1';
const AMOUNT = '100000'; // 0.1 USDC (6 decimals)

export function ServerlessTransfer() {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { paymentResult, error, handleSuccess, handleError, reset, isCompleted } = usePaymentFlow();

  return (
    <ScenarioCard
      title="⚡ Serverless Transfer"
      badge="Serverless Mode"
      description={
        <>
          <p>
            Pay <strong>$0.1 USDC</strong> + dynamic facilitator fee using <code>TransferHook</code> in{' '}
            <strong>Serverless Mode</strong>.
          </p>

          <div
            style={{
              marginTop: '15px',
              padding: '15px',
              backgroundColor: '#e8f9f0',
              borderRadius: '8px',
              border: '1px solid #b3e5d3',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', color: '#0d9c4c' }}>⚡ What is Serverless Mode?</h4>
            <ul style={{ margin: '10px 0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
              <li>
                <strong>✅ No Backend</strong> - Client directly calls facilitator
              </li>
              <li>
                <strong>✅ Zero Infrastructure</strong> - No servers to maintain
              </li>
              <li>
                <strong>✅ 3 Lines of Code</strong> - Ultra-simple integration
              </li>
              <li>
                <strong>✅ Auto Fee Calculation</strong> - SDK queries facilitator for optimal fee
              </li>
              <li>
                <strong>✅ Type-Safe API</strong> - Full TypeScript support
              </li>
            </ul>
          </div>

          <div
            style={{
              marginTop: '15px',
              padding: '15px',
              backgroundColor: '#fff9e6',
              borderRadius: '8px',
              border: '1px solid #ffe4a3',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', color: '#d97706' }}>🔧 How It Works</h4>
            <ol style={{ margin: '10px 0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
              <li>Client SDK queries facilitator for recommended fee</li>
              <li>Client prepares settlement parameters and calculates commitment hash</li>
              <li>
                User signs EIP-3009 authorization for <strong>$0.1 + fee</strong>
              </li>
              <li>Client submits signed authorization to facilitator</li>
              <li>
                Facilitator calls <code>SettlementRouter.settleAndExecute()</code>
              </li>
              <li>
                Router deducts facilitator fee and executes <code>TransferHook</code>
              </li>
              <li>
                Merchant receives <strong>$0.1 USDC</strong>
              </li>
            </ol>
            <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#555' }}>
              💡 All complexity is handled by <code>@x402x/client</code> SDK!
            </p>
          </div>

          <div
            style={{
              marginTop: '15px',
              padding: '15px',
              backgroundColor: '#f0f4ff',
              borderRadius: '8px',
              border: '1px solid #c7d7fe',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', color: '#1e40af' }}>💻 Code Example</h4>
            <pre
              style={{
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                padding: '15px',
                borderRadius: '6px',
                overflow: 'auto',
                fontSize: '12px',
                lineHeight: '1.6',
              }}
            >
              {`import { useX402Client } from '@x402x/client';
import { TransferHook } from '@x402x/core';

const client = useX402Client();

await client.execute({
  hook: TransferHook.getAddress('base-sepolia'),
  hookData: TransferHook.encode(),
  amount: '100000', // 0.1 USDC
  recipient: '0x...'
});`}
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
        idleLabel="💳 Pay $0.1 USDC"
        completedLabel="✅ Payment Complete"
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
          Make Another Payment
        </button>
      )}

      {/* Error Message */}
      {error && (
        <StatusMessage type="error" title="Payment Failed">
          <p style={{ margin: 0 }}>{error}</p>
        </StatusMessage>
      )}

      {/* Success Result */}
      {paymentResult && (
        <TransactionResult
          txHash={paymentResult.txHash}
          network={paymentResult.network}
          details={[
            { label: 'Amount', value: <strong>$0.1 USDC</strong> },
            { label: 'Hook', value: <code>TransferHook</code> },
            { label: 'Mode', value: <strong>Serverless ⚡</strong> },
          ]}
        />
      )}
    </ScenarioCard>
  );
}
