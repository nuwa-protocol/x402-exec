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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
        <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as ScenarioTab)} className="custom-tabs mb-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="split-payment" className="flex flex-col items-center gap-1 h-auto py-3">
              <span className="tab-number">1</span>
              <span className="text-center leading-tight">💸 Split<br/>Payment</span>
            </TabsTrigger>
            <TabsTrigger value="nft-mint" className="flex flex-col items-center gap-1 h-auto py-3">
              <span className="tab-number">2</span>
              <span className="text-center leading-tight">🎨 Pay & Mint<br/>NFT</span>
            </TabsTrigger>
            <TabsTrigger value="points-reward" className="flex flex-col items-center gap-1 h-auto py-3">
              <span className="tab-number">3</span>
              <span className="text-center leading-tight">🎁 Pay & Earn<br/>Points</span>
            </TabsTrigger>
            <TabsTrigger value="premium-download" className="flex flex-col items-center gap-1 h-auto py-3">
              <span className="tab-number">4</span>
              <span className="text-center leading-tight">📥 Premium<br/>Download</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent 
            value="split-payment" 
            className="mt-0" 
            style={{
              padding: '32px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
            }}
          >
            <ServerlessSplitPayment />
          </TabsContent>
          <TabsContent 
            value="nft-mint" 
            className="mt-0" 
            style={{
              padding: '32px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
            }}
          >
            <ServerlessRandomNFT />
          </TabsContent>
          <TabsContent 
            value="points-reward" 
            className="mt-0" 
            style={{
              padding: '32px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
            }}
          >
            <ServerlessPointsReward />
          </TabsContent>
          <TabsContent 
            value="premium-download" 
            className="mt-0" 
            style={{
              padding: '32px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
            }}
          >
            <PremiumDownload />
          </TabsContent>
        </Tabs>
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
