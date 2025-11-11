/**
 * Serverless Random NFT Scenario
 * Pay-to-mint NFT using NFTMintHook in Serverless Mode
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

export function ServerlessRandomNFT() {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { paymentResult, error, handleSuccess, handleError, reset, isCompleted } = usePaymentFlow();

  return (
    <ScenarioCard
      title="⚡ Serverless Random NFT"
      badge="Serverless Mode"
      description={
        <>
          <p>
            Pay <strong>$0.1 USDC</strong> and automatically mint a random NFT after payment using a Serverless
            NFTMintHook.
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
                💸 <strong>Pay-to-Mint</strong>: Payment and NFT minting in one atomic transaction
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                🎲 <strong>Random Selection</strong>: Each mint gets a randomly selected NFT
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                ⚡ <strong>Serverless</strong>: Direct client-to-facilitator execution
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                🔒 <strong>Atomic</strong>: Payment and mint succeed or fail together
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
                {`// 1. Get NFT contract and Hook addresses from env
const nftContract = NFTMintHook.getNFTContractAddress(network);
const hookAddress = NFTMintHook.getAddress(network);

// 2. Encode hookData with NFT config
const hookData = NFTMintHook.encode({
  nftContract,
  tokenId: 0n, // Random mint
  merchant: merchantAddress
});

// 3. Execute payment with NFT mint hook
const result = await client.execute({
  hook: hookAddress,
  hookData,
  amount: '100000', // 0.1 USDC
  recipient: merchantAddress
});`}
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
        idleLabel="🎨 Pay $0.1 & Mint NFT"
        completedLabel="✅ NFT Minted!"
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
          Mint Another NFT
        </button>
      )}

      {/* Error Message */}
      {error && (
        <StatusMessage type="error" title="Minting Failed">
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
            { label: 'Hook', value: <code>NFTMintHook</code> },
            { label: 'Type', value: <strong>Random Mint 🎲</strong> },
            { label: 'Mode', value: <strong>Serverless ⚡</strong> },
          ]}
        />
      )}
    </ScenarioCard>
  );
}
