/**
 * Main application component
 * Manages wallet connection and scenario tab switching
 */

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { WalletConnect } from './components/WalletConnect';
import { DirectPayment } from './scenarios/DirectPayment';
import { ReferralSplit } from './scenarios/ReferralSplit';
import { RandomNFT } from './scenarios/RandomNFT';
import { PointsReward } from './scenarios/PointsReward';
import './App.css';

type ScenarioTab = 'direct-payment' | 'referral' | 'nft' | 'reward';

function App() {
  const [activeTab, setActiveTab] = useState<ScenarioTab>('direct-payment');
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = () => {
    const connector = connectors[0]; // Use first available connector (injected)
    if (connector) {
      connect({ connector });
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1>🎯 Settlement Showcase</h1>
            <p className="subtitle">x402 Payment Scenarios Demo</p>
          </div>
          <WalletConnect
            address={address ?? ''}
            isConnected={isConnected}
            isConnecting={isPending}
            onConnect={handleConnect}
            onDisconnect={disconnect}
          />
        </div>
      </header>

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
        </p>
        <p className="footer-hint">
          All payments are processed on Base Sepolia testnet
        </p>
      </footer>
    </div>
  );
}

export default App;

