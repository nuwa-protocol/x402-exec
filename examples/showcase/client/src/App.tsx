/**
 * Main application component
 * Manages wallet connection and scenario tab switching
 *
 * Modes:
 * - Serverless: Client-side only (Split Payment, NFT Mint, Reward Points)
 * - Server: Server-controlled (Premium Download)
 */

import { useState } from "react";
import { UnifiedDebugPanel } from "./components/UnifiedDebugPanel";
import { ServerlessSplitPayment } from "./scenarios/ServerlessSplitPayment";
import { ServerlessRandomNFT } from "./scenarios/ServerlessRandomNFT";
import { ServerlessPointsReward } from "./scenarios/ServerlessPointsReward";
import { PremiumDownload } from "./scenarios/PremiumDownload";
import "./App.css";

type ScenarioTab = "split-payment" | "nft-mint" | "points-reward" | "premium-download";

function App() {
  const [activeTab, setActiveTab] = useState<ScenarioTab>("split-payment");
  const [showDebug, setShowDebug] = useState<boolean>(false);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1>🎯 x402x Protocol Demo</h1>
            <p className="subtitle">Atomic Payment & Smart Contract Execution</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "split-payment" ? "active" : ""}`}
            onClick={() => setActiveTab("split-payment")}
          >
            <span className="tab-number">1</span>
            <span>💸 Split Payment</span>
            <span
              className="tab-badge"
              style={{
                marginLeft: "8px",
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "4px",
                backgroundColor: "#dbeafe",
                color: "#1e40af",
              }}
            >
              Serverless
            </span>
          </button>
          <button
            className={`tab ${activeTab === "nft-mint" ? "active" : ""}`}
            onClick={() => setActiveTab("nft-mint")}
          >
            <span className="tab-number">2</span>
            <span>🎨 Pay & Mint NFT</span>
            <span
              className="tab-badge"
              style={{
                marginLeft: "8px",
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "4px",
                backgroundColor: "#dbeafe",
                color: "#1e40af",
              }}
            >
              Serverless
            </span>
          </button>
          <button
            className={`tab ${activeTab === "points-reward" ? "active" : ""}`}
            onClick={() => setActiveTab("points-reward")}
          >
            <span className="tab-number">3</span>
            <span>🎁 Pay & Earn Points</span>
            <span
              className="tab-badge"
              style={{
                marginLeft: "8px",
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "4px",
                backgroundColor: "#dbeafe",
                color: "#1e40af",
              }}
            >
              Serverless
            </span>
          </button>
          <button
            className={`tab ${activeTab === "premium-download" ? "active" : ""}`}
            onClick={() => setActiveTab("premium-download")}
          >
            <span className="tab-number">4</span>
            <span>📥 Premium Download</span>
            <span
              className="tab-badge"
              style={{
                marginLeft: "8px",
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "4px",
                backgroundColor: "#fef3c7",
                color: "#92400e",
              }}
            >
              Server
            </span>
          </button>
        </div>

        <div className="scenario-container">
          {activeTab === "split-payment" && <ServerlessSplitPayment />}
          {activeTab === "nft-mint" && <ServerlessRandomNFT />}
          {activeTab === "points-reward" && <ServerlessPointsReward />}
          {activeTab === "premium-download" && <PremiumDownload />}
        </div>
      </main>

      <footer className="app-footer">
        <p>
          Built with{" "}
          <a href="https://x402.org" target="_blank" rel="noopener noreferrer">
            x402 Protocol
          </a>{" "}
          |{" "}
          <a
            href="https://github.com/nuwa-protocol/x402-exec"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>{" "}
          |{" "}
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
              font: "inherit",
            }}
          >
            {showDebug ? "Hide" : "Show"} Debug Info
          </button>
        </p>
        <p className="footer-hint">Click payment buttons to connect wallet and pay</p>
      </footer>

      {/* Unified Debug Panel - floating panel */}
      <UnifiedDebugPanel visible={showDebug} />
    </div>
  );
}

export default App;
