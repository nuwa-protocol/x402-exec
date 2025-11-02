/**
 * Main application component
 * Manages wallet connection and scenario tab switching
 */

import { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { WalletConnect } from './components/WalletConnect';
import { WalletSelector } from './components/WalletSelector';
import { WalletDebugInfo } from './components/WalletDebugInfo';
import { useNetworkSwitch } from './hooks/useNetworkSwitch';
import { DirectPayment } from './scenarios/DirectPayment';
import { ReferralSplit } from './scenarios/ReferralSplit';
import { RandomNFT } from './scenarios/RandomNFT';
import { PointsReward } from './scenarios/PointsReward';
import './App.css';

type ScenarioTab = 'direct-payment' | 'referral' | 'nft' | 'reward';

const FAUCET_HINT_KEY = 'x402-faucet-hint-dismissed';

function App() {
  const [activeTab, setActiveTab] = useState<ScenarioTab>('direct-payment');
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [showWalletSelector, setShowWalletSelector] = useState<boolean>(false);
  const [showFaucetHint, setShowFaucetHint] = useState<boolean>(false);
  
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  
  // Automatically check and switch network when wallet connects
  const { isCheckingNetwork, networkError, clearNetworkError } = useNetworkSwitch();

  // Show faucet hint when wallet connects (if not dismissed before)
  useEffect(() => {
    if (isConnected && address) {
      // Check if user has dismissed the hint before
      const dismissed = localStorage.getItem(FAUCET_HINT_KEY);
      if (!dismissed) {
        setShowFaucetHint(true);
      }
    } else {
      // Hide hint when wallet disconnects
      setShowFaucetHint(false);
    }
  }, [isConnected, address]);

  const handleConnect = () => {
    // Show wallet selector modal instead of auto-connecting
    setShowWalletSelector(true);
  };

  const handleCloseFaucetHint = () => {
    setShowFaucetHint(false);
    // Remember that user has dismissed the hint
    localStorage.setItem(FAUCET_HINT_KEY, 'true');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1>🎯 x402-exec Showcase</h1>
            <p className="subtitle">x402 Payment Scenarios Demo</p>
          </div>
          <WalletConnect
            address={address ?? ''}
            isConnected={isConnected}
            isConnecting={isCheckingNetwork}
            onConnect={handleConnect}
            onDisconnect={disconnect}
          />
        </div>
      </header>

      {/* Network error banner */}
      {networkError && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '16px',
          margin: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Network Error</div>
              <div style={{ fontSize: '14px', color: '#856404' }}>{networkError}</div>
            </div>
          </div>
          <button
            onClick={clearNetworkError}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#856404',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Faucet hint banner - shown after successful network switch */}
      {showFaucetHint && (
        <div style={{
          backgroundColor: '#d4edda',
          border: '2px solid #28a745',
          borderRadius: '8px',
          padding: '20px',
          margin: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
            <span style={{ fontSize: '32px' }}>💰</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#155724', fontSize: '16px' }}>
                Get Free Test USDC
              </div>
              <div style={{ fontSize: '14px', color: '#155724', marginBottom: '12px' }}>
                You'll need USDC to test payments. Get free test USDC for Base Sepolia testnet:
              </div>
              <a 
                href="https://faucet.circle.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
              >
                🚀 Open Circle Faucet
              </a>
            </div>
          </div>
          <button
            onClick={handleCloseFaucetHint}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#155724',
              padding: '8px',
              marginLeft: '16px',
            }}
            title="Close"
          >
            ×
          </button>
        </div>
      )}

      <main className="app-main">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'direct-payment' ? 'active' : ''}`}
            onClick={() => setActiveTab('direct-payment')}
          >
            <span className="tab-number">0</span>
            <span>Simple Payment</span>
          </button>
          <button
            className={`tab ${activeTab === 'referral' ? 'active' : ''}`}
            onClick={() => setActiveTab('referral')}
          >
            <span className="tab-number">1</span>
            <span>Referral Split</span>
          </button>
          <button
            className={`tab ${activeTab === 'nft' ? 'active' : ''}`}
            onClick={() => setActiveTab('nft')}
          >
            <span className="tab-number">2</span>
            <span>NFT Mint</span>
          </button>
          <button
            className={`tab ${activeTab === 'reward' ? 'active' : ''}`}
            onClick={() => setActiveTab('reward')}
          >
            <span className="tab-number">3</span>
            <span>Points Reward</span>
          </button>
        </div>

        <div className="scenario-container">
          {activeTab === 'direct-payment' && <DirectPayment isConnected={isConnected} />}
          {activeTab === 'referral' && <ReferralSplit isConnected={isConnected} />}
          {activeTab === 'nft' && (
            <RandomNFT isConnected={isConnected} walletAddress={address ?? ''} />
          )}
          {activeTab === 'reward' && <PointsReward isConnected={isConnected} />}
        </div>
      </main>

      <footer className="app-footer">
        <p>
          Built with <a href="https://x402.org" target="_blank" rel="noopener noreferrer">x402 Protocol</a>
          {' '} | {' '}
          <a href="https://github.com/nuwa-protocol/x402-exec" target="_blank" rel="noopener noreferrer">
            View on GitHub
          </a>
          {' '} | {' '}
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
              font: 'inherit',
            }}
          >
            {showDebug ? 'Hide' : 'Show'} Debug Info
          </button>
        </p>
        <p className="footer-hint">
          All payments are processed on Base Sepolia testnet
          {' '} | {' '}
          <a 
            href="https://faucet.circle.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#4A90E2', fontWeight: 'bold' }}
          >
            💰 Get Test USDC
          </a>
        </p>
      </footer>

      {/* Wallet Selector Modal */}
      <WalletSelector 
        isOpen={showWalletSelector} 
        onClose={() => setShowWalletSelector(false)} 
      />

      {/* Wallet Debug Info - floating panel */}
      <WalletDebugInfo visible={showDebug} />
    </div>
  );
}

export default App;

