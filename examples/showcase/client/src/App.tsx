/**
 * Main application component
 * Manages wallet connection and scenario tab switching
 */

import { useState } from 'react';
import { WalletDebugInfo } from './components/WalletDebugInfo';
import { FacilitatorDebugPanel } from './components/FacilitatorDebugPanel';
import { DirectPayment } from './scenarios/DirectPayment';
import { ServerlessTransfer } from './scenarios/ServerlessTransfer';
import { ServerlessReferralSplit } from './scenarios/ServerlessReferralSplit';
import { ServerlessRandomNFT } from './scenarios/ServerlessRandomNFT';
import { ServerlessPointsReward } from './scenarios/ServerlessPointsReward';
import { TransferWithHook } from './scenarios/TransferWithHook';
import { ReferralSplit } from './scenarios/ReferralSplit';
import { RandomNFT } from './scenarios/RandomNFT';
import { PointsReward } from './scenarios/PointsReward';
import './App.css';

type ScenarioTab = 'direct-payment' | 'serverless-transfer' | 'serverless-referral' | 'serverless-nft' | 'serverless-reward' | 'transfer-with-hook' | 'referral' | 'nft' | 'reward';

function App() {
  const [activeTab, setActiveTab] = useState<ScenarioTab>('direct-payment');
  const [showDebug, setShowDebug] = useState<boolean>(false);


  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1>🎯 x402-exec Showcase</h1>
            <p className="subtitle">x402 Payment Scenarios Demo</p>
          </div>
        </div>
      </header>


      <main className="app-main">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'direct-payment' ? 'active' : ''}`}
            onClick={() => setActiveTab('direct-payment')}
          >
            <span className="tab-number">0</span>
            <span>Direct Payment</span>
          </button>
          <button
            className={`tab ${activeTab === 'serverless-transfer' ? 'active' : ''}`}
            onClick={() => setActiveTab('serverless-transfer')}
          >
            <span className="tab-number">1</span>
            <span>⚡ Serverless Transfer</span>
          </button>
          <button
            className={`tab ${activeTab === 'serverless-referral' ? 'active' : ''}`}
            onClick={() => setActiveTab('serverless-referral')}
          >
            <span className="tab-number">2</span>
            <span>⚡ Serverless Referral</span>
          </button>
          <button
            className={`tab ${activeTab === 'serverless-nft' ? 'active' : ''}`}
            onClick={() => setActiveTab('serverless-nft')}
          >
            <span className="tab-number">3</span>
            <span>⚡ Serverless NFT</span>
          </button>
          <button
            className={`tab ${activeTab === 'serverless-reward' ? 'active' : ''}`}
            onClick={() => setActiveTab('serverless-reward')}
          >
            <span className="tab-number">4</span>
            <span>⚡ Serverless Reward</span>
          </button>
          <button
            className={`tab ${activeTab === 'transfer-with-hook' ? 'active' : ''}`}
            onClick={() => setActiveTab('transfer-with-hook')}
          >
            <span className="tab-number">5</span>
            <span>Transfer Hook (Server)</span>
          </button>
          <button
            className={`tab ${activeTab === 'referral' ? 'active' : ''}`}
            onClick={() => setActiveTab('referral')}
          >
            <span className="tab-number">6</span>
            <span>Referral Split (Server)</span>
          </button>
          <button
            className={`tab ${activeTab === 'nft' ? 'active' : ''}`}
            onClick={() => setActiveTab('nft')}
          >
            <span className="tab-number">7</span>
            <span>NFT Mint (Server)</span>
          </button>
          <button
            className={`tab ${activeTab === 'reward' ? 'active' : ''}`}
            onClick={() => setActiveTab('reward')}
          >
            <span className="tab-number">8</span>
            <span>Points Reward (Server)</span>
          </button>
        </div>

        <div className="scenario-container">
          {activeTab === 'direct-payment' && <DirectPayment />}
          {activeTab === 'serverless-transfer' && <ServerlessTransfer />}
          {activeTab === 'serverless-referral' && <ServerlessReferralSplit />}
          {activeTab === 'serverless-nft' && <ServerlessRandomNFT />}
          {activeTab === 'serverless-reward' && <ServerlessPointsReward />}
          {activeTab === 'transfer-with-hook' && <TransferWithHook />}
          {activeTab === 'referral' && <ReferralSplit />}
          {activeTab === 'nft' && <RandomNFT />}
          {activeTab === 'reward' && <PointsReward />}
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
          Click payment buttons to connect wallet and pay
        </p>
      </footer>

      {/* Wallet Debug Info - floating panel */}
      <WalletDebugInfo visible={showDebug} />
      
      {/* Facilitator Debug Panel - shows facilitator URL */}
      <FacilitatorDebugPanel />
    </div>
  );
}

export default App;

