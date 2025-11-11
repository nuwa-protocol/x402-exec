/**
 * Unified Debug Panel Component
 * Combines wallet connection status and configuration info in a tabbed interface
 */

import { useState } from 'react';
import { useAccount, useWalletClient, useConnectorClient, useConnectors } from 'wagmi';
import { useEffect } from 'react';
import { createWalletClient, custom } from 'viem';
import { type WalletClient } from 'viem';
import { getFacilitatorUrl, getServerUrl } from '../config';

interface UnifiedDebugPanelProps {
  visible?: boolean;
}

type DebugTab = 'wallet' | 'config';

export function UnifiedDebugPanel({ visible = false }: UnifiedDebugPanelProps) {
  const [activeTab, setActiveTab] = useState<DebugTab>('wallet');
  
  // Wallet-related hooks
  const { address, isConnected, connector: activeConnector, chain } = useAccount();
  const { data: walletClient } = useWalletClient({ account: address });
  const { data: connectorClient } = useConnectorClient();
  const connectors = useConnectors();
  const [manualClient, setManualClient] = useState<WalletClient | null>(null);
  
  // Config-related data
  const facilitatorUrl = getFacilitatorUrl();
  const serverUrl = getServerUrl();
  const isLocalFacilitator = facilitatorUrl.includes('localhost') || facilitatorUrl.includes('127.0.0.1');
  const isLocalServer = serverUrl && (serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1'));

  // Try manual wallet client creation as fallback
  useEffect(() => {
    const createManual = async () => {
      if (!connectorClient && activeConnector && isConnected && address && chain) {
        try {
          const provider = await activeConnector.getProvider();
          if (provider && typeof provider === 'object') {
            const client = createWalletClient({
              account: address,
              chain: chain,
              transport: custom(provider as any),
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
        maxWidth: '450px',
        maxHeight: '80vh',
        overflow: 'hidden',
        fontSize: '12px',
        fontFamily: 'monospace',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #dee2e6',
          backgroundColor: '#fff',
        }}
      >
        <button
          onClick={() => setActiveTab('wallet')}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: 'none',
            backgroundColor: activeTab === 'wallet' ? '#f8f9fa' : '#fff',
            borderBottom: activeTab === 'wallet' ? '3px solid #007bff' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'wallet' ? 'bold' : 'normal',
            fontSize: '13px',
            fontFamily: 'system-ui',
            color: activeTab === 'wallet' ? '#007bff' : '#6c757d',
            transition: 'all 0.2s',
          }}
        >
          🔍 Wallet
        </button>
        <button
          onClick={() => setActiveTab('config')}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: 'none',
            backgroundColor: activeTab === 'config' ? '#f8f9fa' : '#fff',
            borderBottom: activeTab === 'config' ? '3px solid #007bff' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'config' ? 'bold' : 'normal',
            fontSize: '13px',
            fontFamily: 'system-ui',
            color: activeTab === 'config' ? '#007bff' : '#6c757d',
            transition: 'all 0.2s',
          }}
        >
          🔧 Config
        </button>
      </div>

      {/* Content Area */}
      <div
        style={{
          padding: '15px',
          overflow: 'auto',
          flex: 1,
        }}
      >
        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
              Wallet Debug Info
            </div>

            <div style={{ marginBottom: '10px' }}>
              <strong>useAccount:</strong>
              <div style={{ paddingLeft: '10px', marginTop: '4px' }}>
                <div>
                  isConnected:{' '}
                  <span style={{ color: isConnected ? 'green' : 'red' }}>{String(isConnected)}</span>
                </div>
                <div>address: {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : 'null'}</div>
                <div>connector: {activeConnector?.name || 'null'}</div>
                <div>connectorId: {activeConnector?.id || 'null'}</div>
                <div>chain: {chain?.id || 'null'}</div>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <strong>useWalletClient:</strong>
              <div style={{ paddingLeft: '10px', marginTop: '4px' }}>
                <div>
                  exists: <span style={{ color: walletClient ? 'green' : 'red' }}>{String(!!walletClient)}</span>
                </div>
                {walletClient && (
                  <>
                    <div>
                      account:{' '}
                      {walletClient.account?.address ? `${walletClient.account.address.slice(0, 10)}...` : 'null'}
                    </div>
                    <div>chain: {walletClient.chain?.id || 'null'}</div>
                  </>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <strong>useConnectorClient:</strong>
              <div style={{ paddingLeft: '10px', marginTop: '4px' }}>
                <div>
                  exists:{' '}
                  <span style={{ color: connectorClient ? 'green' : 'red' }}>{String(!!connectorClient)}</span>
                </div>
                {connectorClient && (
                  <>
                    <div>
                      account:{' '}
                      {connectorClient.account?.address
                        ? `${connectorClient.account.address.slice(0, 10)}...`
                        : 'null'}
                    </div>
                    <div>chain: {connectorClient.chain?.id || 'null'}</div>
                  </>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <strong>Manual Client (Fallback):</strong>
              <div style={{ paddingLeft: '10px', marginTop: '4px' }}>
                <div>
                  exists: <span style={{ color: manualClient ? 'green' : 'red' }}>{String(!!manualClient)}</span>
                </div>
                {manualClient && (
                  <>
                    <div>
                      account:{' '}
                      {manualClient.account?.address ? `${manualClient.account.address.slice(0, 10)}...` : 'null'}
                    </div>
                    <div>chain: {manualClient.chain?.id || 'null'}</div>
                  </>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <strong>Available Connectors:</strong>
              <div style={{ paddingLeft: '10px', marginTop: '4px' }}>
                {connectors.map((connector, idx) => (
                  <div key={connector.uid} style={{ marginBottom: '4px' }}>
                    {idx + 1}. {connector.name}{' '}
                    <span style={{ color: connector.id === activeConnector?.id ? 'green' : 'gray' }}>
                      {connector.id === activeConnector?.id ? ' (active)' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: '12px',
                padding: '10px',
                backgroundColor: finalClient ? '#d4edda' : '#f8d7da',
                borderRadius: '4px',
                border: `1px solid ${finalClient ? '#c3e6cb' : '#f5c6cb'}`,
                fontSize: '11px',
                fontFamily: 'system-ui',
              }}
            >
              <strong>💡 Status:</strong>{' '}
              {finalClient
                ? `✅ ${connectorClient ? 'Using connectorClient' : 'Using manual fallback client'} - Ready for payment!`
                : '❌ No wallet client available. Try refreshing the page or reconnecting your wallet.'}
            </div>
          </div>
        )}

        {/* Config Tab */}
        {activeTab === 'config' && (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
              Configuration Info
            </div>

            <div style={{ marginBottom: '10px' }}>
              <strong>Facilitator:</strong>
              <div
                style={{
                  marginTop: '4px',
                  padding: '8px',
                  backgroundColor: isLocalFacilitator ? '#fff3cd' : '#e9ecef',
                  borderRadius: '4px',
                  wordBreak: 'break-all',
                  fontSize: '11px',
                  border: isLocalFacilitator ? '1px solid #ffc107' : 'none',
                }}
              >
                {facilitatorUrl}
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <strong>Server:</strong>
              <div
                style={{
                  marginTop: '4px',
                  padding: '8px',
                  backgroundColor: isLocalServer ? '#fff3cd' : '#e9ecef',
                  borderRadius: '4px',
                  wordBreak: 'break-all',
                  fontSize: '11px',
                  border: isLocalServer ? '1px solid #ffc107' : 'none',
                }}
              >
                {serverUrl || '(relative - Vite proxy)'}
              </div>
            </div>

            {(isLocalFacilitator || isLocalServer) && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #ffc107',
                }}
              >
                <div style={{ color: '#856404', fontWeight: 'bold', marginBottom: '6px', fontSize: '12px' }}>
                  ⚠️ Local Development Mode
                </div>
                <div style={{ color: '#856404', fontSize: '11px', fontFamily: 'system-ui' }}>
                  {isLocalFacilitator && <div>• Facilitator: localhost</div>}
                  {isLocalServer && <div>• Server: localhost</div>}
                  <div style={{ marginTop: '6px' }}>Make sure local services are running!</div>
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid #dee2e6',
                fontSize: '11px',
                color: '#6c757d',
                fontFamily: 'system-ui',
              }}
            >
              💡 To change: Edit <code>.env</code> and restart dev server
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

