/**
 * Wagmi configuration for wallet connection
 * Supports multiple networks: Base Sepolia, X-Layer Testnet, Base Mainnet, X-Layer Mainnet
 */

import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, metaMask, coinbaseWallet } from 'wagmi/connectors';
import { xLayerTestnet, xLayer } from './config';

// Configure wagmi with multiple wallet connectors and chains
export const config = createConfig({
  chains: [baseSepolia, xLayerTestnet, base, xLayer],
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
    [base.id]: http(),
    [xLayer.id]: http(),
  },
  // Enable multi-injected provider discovery (for multi-wallet support)
  multiInjectedProviderDiscovery: true,
});

