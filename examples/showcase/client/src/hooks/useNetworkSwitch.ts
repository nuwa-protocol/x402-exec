/**
 * Network Switch Hook
 * Provides functionality to switch wallet to a specific network
 */

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { Network, NETWORKS } from "../config";

// Type for EIP-1193 provider
interface EIP1193Provider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
}

export function useNetworkSwitch() {
  const { connector } = useAccount();
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  /**
   * Switch wallet to specified network
   */
  const switchToNetwork = useCallback(
    async (network: Network): Promise<boolean> => {
      if (!connector) {
        setSwitchError("No wallet connected");
        return false;
      }

      setIsSwitching(true);
      setSwitchError(null);

      try {
        const provider = (await connector.getProvider()) as EIP1193Provider;

        if (!provider || typeof provider.request !== "function") {
          console.log("[Network] Provider does not support network switching");
          setSwitchError("Wallet does not support network switching");
          setIsSwitching(false);
          return false;
        }

        const config = NETWORKS[network];
        const chainIdHex = `0x${config.chainId.toString(16)}`;

        // Check current network
        const currentChainId = (await provider.request({ method: "eth_chainId" })) as string;
        console.log("[Network] Current chain ID:", currentChainId, "Target:", chainIdHex);

        if (currentChainId === chainIdHex) {
          console.log(`[Network] Already on ${config.displayName}`);
          setIsSwitching(false);
          return true;
        }

        console.log(`[Network] Switching to ${config.displayName}...`);

        try {
          // Try to switch to the network
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
          });

          console.log(`[Network] Successfully switched to ${config.displayName}`);
          setIsSwitching(false);
          return true;
        } catch (switchError: any) {
          console.error("[Network] Switch error:", switchError);

          // This error code indicates that the chain has not been added to the wallet
          if (switchError.code === 4902) {
            console.log("[Network] Chain not found in wallet, attempting to add...");

            try {
              await provider.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: chainIdHex,
                    chainName: config.displayName,
                    nativeCurrency: config.chain.nativeCurrency,
                    rpcUrls: config.chain.rpcUrls.default.http,
                    blockExplorerUrls: config.chain.blockExplorers
                      ? [config.chain.blockExplorers.default.url]
                      : undefined,
                  },
                ],
              });

              console.log(`[Network] Successfully added and switched to ${config.displayName}`);
              setIsSwitching(false);
              return true;
            } catch (addError: any) {
              console.error("[Network] Failed to add chain:", addError);
              setSwitchError(`Please manually add ${config.displayName} network in your wallet`);
              setIsSwitching(false);
              return false;
            }
          } else if (switchError.code === 4001) {
            // User rejected the request
            console.log("[Network] User rejected network switch");
            setSwitchError("Network switch cancelled by user");
            setIsSwitching(false);
            return false;
          } else {
            setSwitchError(`Failed to switch network: ${switchError.message || "Unknown error"}`);
            setIsSwitching(false);
            return false;
          }
        }
      } catch (error: any) {
        console.error("[Network] Error switching network:", error);
        setSwitchError("Unable to switch network");
        setIsSwitching(false);
        return false;
      }
    },
    [connector],
  );

  return {
    switchToNetwork,
    isSwitching,
    switchError,
    clearSwitchError: () => setSwitchError(null),
  };
}
