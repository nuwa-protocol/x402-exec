/**
 * Auto-generated Wagmi configuration
 * Automatically supports all networks from @x402x/extensions
 */

import { http, createConfig } from "wagmi";
import { getSupportedNetworkNames, getChain } from "@x402x/extensions";
import { injected, metaMask, coinbaseWallet } from "wagmi/connectors";

// Auto-generate chains array from @x402x/extensions
const supportedNetworks = getSupportedNetworkNames();
const chains = supportedNetworks.map((network) => getChain(network));

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
