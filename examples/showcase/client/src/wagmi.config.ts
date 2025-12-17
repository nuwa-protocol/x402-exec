/**
 * Auto-generated Wagmi configuration
 * Automatically supports all networks from @x402x/core
 */

import { http, createConfig } from "wagmi";
import { getSupportedNetworks } from "@x402x/core";
import { evm } from "x402/types";
import { injected, metaMask, coinbaseWallet } from "wagmi/connectors";
import type { Chain } from "viem";

// Auto-generate chains array from @x402x/core
const supportedNetworks = getSupportedNetworks();
const chains = supportedNetworks.map((network) => evm.getChainFromNetwork(network) as Chain);

// Auto-generate transports for all chains
const transports = chains.reduce(
  (acc, chain) => {
    acc[chain.id] = http();
    return acc;
  },
  {} as Record<number, ReturnType<typeof http>>,
);

// Configure wagmi with auto-generated chains and transports
export const config = createConfig({
  chains: chains as any, // Wagmi requires at least one chain
  connectors: [
    // Explicitly target specific wallets to avoid conflicts
    metaMask(),
    coinbaseWallet({
      appName: "x402x Protocol Demo",
    }),
    // Fallback to generic injected for other wallets
    injected(),
  ],
  transports,
  // Enable multi-injected provider discovery (for multi-wallet support)
  multiInjectedProviderDiscovery: true,
});
