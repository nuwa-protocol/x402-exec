/**
 * Wallet connection hook
 * Handles wallet connection state and address management
 */

import { useState, useEffect } from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import { baseSepolia } from "viem/chains";

export function useWallet() {
  const [address, setAddress] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  // Check if wallet is already connected
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window.ethereum === "undefined") return;

      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          const client = createWalletClient({
            chain: baseSepolia,
            transport: custom(window.ethereum),
          });
          setWalletClient(client);
        }
      } catch (error) {
        console.error("Failed to check wallet connection:", error);
      }
    };

    checkConnection();
  }, []);

  const connect = async () => {
    if (typeof window.ethereum === "undefined") {
      alert("Please install MetaMask or another Web3 wallet");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        setAddress(accounts[0]);
        const client = createWalletClient({
          chain: baseSepolia,
          transport: custom(window.ethereum),
        });
        setWalletClient(client);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      alert("Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress("");
    setWalletClient(null);
  };

  return {
    address,
    isConnected: !!address,
    isConnecting,
    walletClient,
    connect,
    disconnect,
  };
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}
