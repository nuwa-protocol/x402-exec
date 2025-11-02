/**
 * Wallet Selector Modal
 * Allows users to choose which wallet to connect with
 */

import { useConnect, useConnectors } from 'wagmi';

interface WalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletSelector({ isOpen, onClose }: WalletSelectorProps) {
  const { connect, isPending } = useConnect();
  const connectors = useConnectors();

  if (!isOpen) return null;

  const handleConnect = (connectorId: string) => {
    const connector = connectors.find(c => c.id === connectorId);
    if (connector) {
      connect({ connector });
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Select Wallet</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
          Choose the wallet you want to connect. Make sure the wallet is installed and unlocked.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => handleConnect(connector.id)}
              disabled={isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px',
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                backgroundColor: 'white',
                cursor: isPending ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontSize: '16px',
                fontWeight: '500',
                opacity: isPending ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isPending) {
                  e.currentTarget.style.borderColor = '#4A90E2';
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              <div style={{ 
                width: '32px', 
                height: '32px', 
                marginRight: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
              }}>
                {getWalletIcon(connector.name)}
              </div>
              <span>{connector.name}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#fff3cd', borderRadius: '8px', fontSize: '13px', color: '#856404', border: '1px solid #ffeaa7' }}>
          <strong>💡 Tip:</strong> If you have multiple wallets installed, please keep only the one you want to use enabled, and temporarily disable others to avoid conflicts.
        </div>
      </div>
    </div>
  );
}

function getWalletIcon(walletName: string): string {
  const icons: Record<string, string> = {
    'MetaMask': '🦊',
    'Coinbase Wallet': '💼',
    'OneKey': '🔑',
    'OKX Wallet': '⭕',
    'Phantom': '👻',
    'SubWallet': '💎',
    'Keplr': '🌌',
    'Ronin Wallet': '⚔️',
    'Injected': '💉',
  };
  return icons[walletName] || '🔌';
}

