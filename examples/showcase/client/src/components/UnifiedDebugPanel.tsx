/**
 * Unified Debug Panel Component
 * Combines wallet connection status and configuration info in a tabbed interface
 */

import { useState } from "react";
import { useAccount, useWalletClient, useConnectorClient, useConnectors } from "wagmi";
import { useEffect } from "react";
import { createWalletClient, custom } from "viem";
import { type WalletClient } from "viem";
import { getFacilitatorUrl, getServerUrl } from "../config";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UnifiedDebugPanelProps {
  visible?: boolean;
}

type DebugTab = "wallet" | "config";

function UnifiedDebugPanel({ visible = false }: UnifiedDebugPanelProps) {
  const [activeTab, setActiveTab] = useState<DebugTab>("wallet");

  const { address, isConnected, connector: activeConnector, chain } = useAccount();
  const { data: walletClient } = useWalletClient({ account: address });
  const { data: connectorClient } = useConnectorClient();
  const connectors = useConnectors();
  const [manualClient, setManualClient] = useState<WalletClient | null>(null);

  // Config-related data
  const facilitatorUrl = getFacilitatorUrl();
  const serverUrl = getServerUrl();
  const isLocalFacilitator =
    facilitatorUrl.includes("localhost") || facilitatorUrl.includes("127.0.0.1");
  const isLocalServer =
    serverUrl && (serverUrl.includes("localhost") || serverUrl.includes("127.0.0.1"));

  // Try manual wallet client creation as fallback
  useEffect(() => {
    const createManual = async () => {
      if (!connectorClient && activeConnector && isConnected && address && chain) {
        try {
          const provider = await activeConnector.getProvider();
          if (provider && typeof provider === "object") {
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
    <Card className="fixed bottom-5 right-5 w-full max-w-md max-h-[80vh] overflow-hidden z-50 flex flex-col font-mono text-xs shadow-brand-xl bg-white">
      <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as DebugTab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="wallet">🔍 Wallet</TabsTrigger>
          <TabsTrigger value="config">🔧 Config</TabsTrigger>
        </TabsList>

        <div className="p-4 overflow-auto flex-1">
          <TabsContent value="wallet" className="mt-0">
            <div className="font-bold mb-3 text-sm">
              Wallet Debug Info
            </div>

            <div className="mb-2.5">
              <strong>useAccount:</strong>
              <div className="pl-2.5 mt-1">
                <div>
                  isConnected:{" "}
                  <span className={isConnected ? "text-green-600" : "text-red-600"}>
                    {String(isConnected)}
                  </span>
                </div>
                <div>
                  address: {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : "null"}
                </div>
                <div>connector: {activeConnector?.name || "null"}</div>
                <div>connectorId: {activeConnector?.id || "null"}</div>
                <div>chain: {chain?.id || "null"}</div>
              </div>
            </div>

            <div className="mb-2.5">
              <strong>useWalletClient:</strong>
              <div className="pl-2.5 mt-1">
                <div>
                  exists:{" "}
                  <span className={walletClient ? "text-green-600" : "text-red-600"}>
                    {String(!!walletClient)}
                  </span>
                </div>
                {walletClient && (
                  <>
                    <div>
                      account:{" "}
                      {walletClient.account?.address
                        ? `${walletClient.account.address.slice(0, 10)}...`
                        : "null"}
                    </div>
                    <div>chain: {walletClient.chain?.id || "null"}</div>
                  </>
                )}
              </div>
            </div>

            <div className="mb-2.5">
              <strong>useConnectorClient:</strong>
              <div className="pl-2.5 mt-1">
                <div>
                  exists:{" "}
                  <span className={connectorClient ? "text-green-600" : "text-red-600"}>
                    {String(!!connectorClient)}
                  </span>
                </div>
                {connectorClient && (
                  <>
                    <div>
                      account:{" "}
                      {connectorClient.account?.address
                        ? `${connectorClient.account.address.slice(0, 10)}...`
                        : "null"}
                    </div>
                    <div>chain: {connectorClient.chain?.id || "null"}</div>
                  </>
                )}
              </div>
            </div>

            <div className="mb-2.5">
              <strong>Manual Client (Fallback):</strong>
              <div className="pl-2.5 mt-1">
                <div>
                  exists:{" "}
                  <span className={manualClient ? "text-green-600" : "text-red-600"}>
                    {String(!!manualClient)}
                  </span>
                </div>
                {manualClient && (
                  <>
                    <div>
                      account:{" "}
                      {manualClient.account?.address
                        ? `${manualClient.account.address.slice(0, 10)}...`
                        : "null"}
                    </div>
                    <div>chain: {manualClient.chain?.id || "null"}</div>
                  </>
                )}
              </div>
            </div>

            <div className="mb-2.5">
              <strong>Available Connectors:</strong>
              <div className="pl-2.5 mt-1">
                {connectors.map((connector, idx) => (
                  <div key={connector.uid} className="mb-1">
                    {idx + 1}. {connector.name}{" "}
                    <span
                      className={connector.id === activeConnector?.id ? "text-green-600" : "text-gray-500"}
                    >
                      {connector.id === activeConnector?.id ? " (active)" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`mt-3 p-2.5 rounded text-xs font-system ${
              finalClient
                ? "bg-green-100 border border-green-200 text-green-800"
                : "bg-red-100 border border-red-200 text-red-800"
            }`}>
              <strong>💡 Status:</strong>{" "}
              {finalClient
                ? `✅ ${connectorClient ? "Using connectorClient" : "Using manual fallback client"} - Ready for payment!`
                : "❌ No wallet client available. Try refreshing the page or reconnecting your wallet."}
            </div>
          </TabsContent>

          <TabsContent value="config" className="mt-0">
            <div className="font-bold mb-3 text-sm">
              Configuration Info
            </div>

            <div className="mb-2.5">
              <strong>Facilitator:</strong>
              <div className={`mt-1 p-2 rounded break-all text-xs ${
                isLocalFacilitator
                  ? "bg-yellow-100 border border-yellow-400"
                  : "bg-gray-200"
              }`}>
                {facilitatorUrl}
              </div>
            </div>

            <div className="mb-2.5">
              <strong>Server:</strong>
              <div className={`mt-1 p-2 rounded break-all text-xs ${
                isLocalServer
                  ? "bg-yellow-100 border border-yellow-400"
                  : "bg-gray-200"
              }`}>
                {serverUrl || "(relative - Vite proxy)"}
              </div>
            </div>

            {(isLocalFacilitator || isLocalServer) && (
              <div className="mt-3 p-2.5 bg-white border border-yellow-400 rounded">
                <div className="text-yellow-800 font-bold mb-1.5 text-xs">
                  ⚠️ Local Development Mode
                </div>
                <div className="text-yellow-800 text-xs font-system">
                  {isLocalFacilitator && <div>• Facilitator: localhost</div>}
                  {isLocalServer && <div>• Server: localhost</div>}
                  <div className="mt-1.5">Make sure local services are running!</div>
                </div>
              </div>
            )}

            <div className="mt-3 pt-2.5 border-t border-gray-300 text-xs text-gray-600 font-system">
              💡 To change: Edit <code>.env</code> and restart dev server
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
}

export default UnifiedDebugPanel;
