/**
 * Wagmi configuration for wallet connection
 */

import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { injected, metaMask, coinbaseWallet } from 'wagmi/connectors';

// Configure wagmi with multiple wallet connectors
export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    // Explicitly target specific wallets to avoid conflicts
    metaMask(),
    coinbaseWallet({
      appName: 'x402-exec Showcase',
    }),
    // Fallback to generic injected for other wallets
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
  // Enable multi-injected provider discovery (for multi-wallet support)
  multiInjectedProviderDiscovery: true,
});

