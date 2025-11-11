/**
 * Wagmi configuration for wallet connection
 * Supports multiple networks: Base Sepolia and X-Layer Testnet
 */

import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { injected, metaMask, coinbaseWallet } from 'wagmi/connectors';
import { xLayerTestnet } from './config';

// Configure wagmi with multiple wallet connectors and chains
export const config = createConfig({
  chains: [baseSepolia, xLayerTestnet],
  connectors: [
    // Explicitly target specific wallets to avoid conflicts
    metaMask(),
    coinbaseWallet({
      appName: 'x402x Protocol Demo',
    }),
    // Fallback to generic injected for other wallets
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [xLayerTestnet.id]: http(),
  },
  // Enable multi-injected provider discovery (for multi-wallet support)
  multiInjectedProviderDiscovery: true,
});

