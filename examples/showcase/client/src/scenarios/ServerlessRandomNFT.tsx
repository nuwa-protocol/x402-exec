/**
 * Serverless Random NFT Scenario
 * Pay-to-mint NFT using NFTMintHook in Serverless Mode
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
import { useAllNetworksNFTData } from '../hooks/useNFTData';
import { NFTMintHook } from '../hooks/NFTMintHook';
import { NETWORK_UI_CONFIG } from '../config';
import nftMintCode from '../code-examples/nft-mint.ts?raw';

const AMOUNT = '100000'; // 0.1 USDC (6 decimals)

export function ServerlessRandomNFT() {
  const { address: connectedAddress } = useAccount();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { paymentResult, error, handleSuccess, handleError, reset, isCompleted } = usePaymentFlow();
  
  // Read NFT data from all networks
  const allNetworksData = useAllNetworksNFTData();

  // Prepare hook and hookData for NFT minting
  const prepareNFTMint = () => {
    if (!connectedAddress) {
      return { hook: undefined, hookData: undefined };
    }

    // Get NFT mint hook address (network-agnostic, will be resolved per network)
    const hook = NFTMintHook.getAddress('base-sepolia'); // Will be dynamically selected in dialog
    
    // Get NFT contract address from environment
    const nftAddresses = {
      'base-sepolia': import.meta.env.VITE_BASE_SEPOLIA_RANDOM_NFT_ADDRESS || '0x0000000000000000000000000000000000000000',
      'x-layer-testnet': import.meta.env.VITE_X_LAYER_TESTNET_RANDOM_NFT_ADDRESS || '0x0000000000000000000000000000000000000000',
    };
    const nftContract = nftAddresses['base-sepolia']; // Will be dynamically selected
    
    // Encode hookData: (nftContract, tokenId=0 for random, merchant=payer to return funds)
    const hookData = encodeAbiParameters(
      [
        { name: 'nftContract', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'merchant', type: 'address' }
      ],
      [
        nftContract as Address,
        0n, // 0 for random NFT selection
        connectedAddress as Address // merchant = payer (funds return to user)
      ]
    );

    return { hook: hook as `0x${string}`, hookData: hookData as `0x${string}` };
  };

  const { hook, hookData } = prepareNFTMint();

  return (
    <ScenarioCard
      title="🎨 Pay & Mint NFT"
      badge="Serverless Mode"
      description={
        <>
          <p>
            Pay <strong>$0.1 USDC</strong> and automatically mint a random NFT. Your USDC returns to your wallet!
          </p>

          {/* NFT Statistics Table */}
          <div
            style={{
              margin: '20px 0',
              padding: '15px',
              backgroundColor: '#fff7ed',
              borderRadius: '8px',
              border: '2px solid #fdba74',
            }}
          >
            <h4 style={{ margin: '0 0 15px 0', color: '#c2410c', fontSize: '15px' }}>
              📊 NFT Collection Statistics (Multi-Network)
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fed7aa', borderBottom: '2px solid #fdba74' }}>
                  <th style={{ padding: '10px', textAlign: 'left', color: '#9a3412', fontWeight: 'bold' }}>Network</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#9a3412', fontWeight: 'bold' }}>Total Minted</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#9a3412', fontWeight: 'bold' }}>Max Supply</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#9a3412', fontWeight: 'bold' }}>Remaining</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#9a3412', fontWeight: 'bold' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(allNetworksData).map(([network, data]) => {
                  const uiConfig = NETWORK_UI_CONFIG[network as keyof typeof NETWORK_UI_CONFIG];
                  return (
                    <tr key={network} style={{ borderBottom: '1px solid #fed7aa' }}>
                      <td style={{ padding: '12px', color: '#78350f' }}>
                        <span style={{ marginRight: '6px' }}>{uiConfig.icon}</span>
                        <strong>{uiConfig.displayName}</strong>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#c2410c', fontWeight: 'bold', fontSize: '16px' }}>
                        {data.loading ? '...' : data.error ? '-' : data.totalSupply.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#c2410c', fontWeight: 'bold', fontSize: '16px' }}>
                        {data.loading ? '...' : data.error ? '-' : data.maxSupply.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#15803d', fontWeight: 'bold', fontSize: '16px' }}>
                        {data.loading ? '...' : data.error ? '-' : data.remainingSupply.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {data.loading ? (
                          <span style={{ color: '#9a3412', fontSize: '12px' }}>Loading...</span>
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

          {/* Mainnet Fund Circulation */}
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
              💰 How Payment Works
            </h4>
            <div style={{ fontSize: '14px', lineHeight: 1.8, color: '#166534' }}>
              <p style={{ margin: '0 0 8px 0' }}>
                <strong>💸 Payment Flow:</strong> You pay $0.1 USDC, which returns to your wallet after NFT minting
              </p>
              <p style={{ margin: '0 0 8px 0' }}>
                <strong>✨ What You Get:</strong> NFT minted to your wallet
              </p>
              <p style={{ margin: 0 }}>
                <strong>💵 Net Cost:</strong> Only facilitator fee (~$0.01) + gas
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
                💸 <strong>Pay-to-Mint</strong>: Payment and NFT minting in one atomic transaction
              </li>
              <li style={{ margin: '8px 0', lineHeight: 1.6 }}>
                🔄 <strong>Fund Circulation</strong>: merchant = payer, USDC returns to your wallet
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
              <li>Click "Pay & Mint NFT" to start the payment process</li>
              <li>Connect your wallet if not already connected</li>
              <li>Review the payment details and sign the authorization</li>
              <li>Facilitator executes payment + NFT minting atomically</li>
              <li>NFT appears in your wallet, USDC returns to you</li>
            </ol>
          </div>

          <CodeBlock
            code={nftMintCode}
            title="🔧 Technical Flow:"
            borderColor="#28a745"
          />
        </>
      }
    >
      {/* Payment Dialog - use NFT mint hook */}
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
        idleLabel="🎨 Pay $0.1 & Mint NFT"
        completedLabel="✅ NFT Minted & Funds Returned!"
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
            { label: 'Payment', value: <strong>$0.1 USDC (returned to you)</strong> },
            { label: 'NFT', value: <strong>Minted to your wallet 🎨</strong> },
            { label: 'Hook', value: <code>NFTMintHook</code> },
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
