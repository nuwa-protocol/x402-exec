/**
 * Wallet Debug Info Component
 * Shows detailed wallet connection status to help diagnose multi-wallet issues
 */

import { useAccount, useWalletClient, useConnectorClient, useConnectors } from 'wagmi';
import { useState, useEffect } from 'react';
import { createWalletClient, custom } from 'viem';
import { type WalletClient } from 'viem';

interface WalletDebugInfoProps {
  visible?: boolean;
}

export function WalletDebugInfo({ visible = false }: WalletDebugInfoProps) {
  const { address, isConnected, connector: activeConnector, chain } = useAccount();
  // Try both methods to get wallet client
  const { data: walletClient } = useWalletClient({ 
    account: address,
  });
  const { data: connectorClient } = useConnectorClient();
  const connectors = useConnectors();
  
  // Try manual creation as fallback
  const [manualClient, setManualClient] = useState<WalletClient | null>(null);
  
  useEffect(() => {
    const createManual = async () => {
      if (!connectorClient && activeConnector && isConnected && address && chain) {
        try {
          const provider = await activeConnector.getProvider();
          if (provider && typeof provider === 'object') {
            const client = createWalletClient({
              account: address,
              chain: chain,
              transport: custom(provider as any), // Use 'as any' for non-standard wallet providers
            });
            setManualClient(client);
          }
        } catch (err) {
          setManualClient(null);
        }
      } else {
        setManualClient(null);
      }
    };
    createManual();
  }, [connectorClient, activeConnector, isConnected, address, chain]);

  if (!visible) return null;

  const finalClient = connectorClient || manualClient;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: '#f8f9fa',
        border: '2px solid #dee2e6',
        borderRadius: '8px',
        padding: '15px',
        maxWidth: '450px',
        maxHeight: '80vh',
        overflow: 'auto',
        fontSize: '12px',
        fontFamily: 'monospace',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 9999,
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>
        🔍 Wallet Debug Info
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>useAccount:</strong>
        <div style={{ paddingLeft: '10px', marginTop: '4px' }}>
          <div>isConnected: <span style={{ color: isConnected ? 'green' : 'red' }}>{String(isConnected)}</span></div>
          <div>address: {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : 'null'}</div>
          <div>connector: {activeConnector?.name || 'null'}</div>
          <div>connectorId: {activeConnector?.id || 'null'}</div>
          <div>chain: {chain?.id || 'null'}</div>
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <strong>useWalletClient:</strong>
        <div style={{ paddingLeft: '10px', marginTop: '4px' }}>
          <div>exists: <span style={{ color: walletClient ? 'green' : 'red' }}>{String(!!walletClient)}</span></div>
          {walletClient && (
            <>
              <div>account: {walletClient.account?.address ? `${walletClient.account.address.slice(0, 10)}...` : 'null'}</div>
              <div>chain: {walletClient.chain?.id || 'null'}</div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <strong>useConnectorClient:</strong>
        <div style={{ paddingLeft: '10px', marginTop: '4px' }}>
          <div>exists: <span style={{ color: connectorClient ? 'green' : 'red' }}>{String(!!connectorClient)}</span></div>
          {connectorClient && (
            <>
              <div>account: {connectorClient.account?.address ? `${connectorClient.account.address.slice(0, 10)}...` : 'null'}</div>
              <div>chain: {connectorClient.chain?.id || 'null'}</div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <strong>Manual Client (Fallback):</strong>
        <div style={{ paddingLeft: '10px', marginTop: '4px' }}>
          <div>exists: <span style={{ color: manualClient ? 'green' : 'red' }}>{String(!!manualClient)}</span></div>
          {manualClient && (
            <>
              <div>account: {manualClient.account?.address ? `${manualClient.account.address.slice(0, 10)}...` : 'null'}</div>
              <div>chain: {manualClient.chain?.id || 'null'}</div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <strong>Available Connectors:</strong>
        <div style={{ paddingLeft: '10px', marginTop: '4px' }}>
          {connectors.map((connector, idx) => (
            <div key={connector.uid} style={{ marginBottom: '4px' }}>
              {idx + 1}. {connector.name} 
              <span style={{ color: connector.id === activeConnector?.id ? 'green' : 'gray' }}>
                {connector.id === activeConnector?.id ? ' (active)' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '10px', padding: '8px', backgroundColor: finalClient ? '#d4edda' : '#f8d7da', borderRadius: '4px', border: `1px solid ${finalClient ? '#c3e6cb' : '#f5c6cb'}` }}>
        <strong>💡 Status:</strong> {finalClient 
          ? `✅ ${connectorClient ? 'Using connectorClient' : 'Using manual fallback client'} - Ready for payment!`
          : '❌ No wallet client available. Try refreshing the page or reconnecting your wallet.'
        }
      </div>
    </div>
  );
}

