/**
 * Wagmi configuration for wallet connection
 */

import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Configure wagmi
export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(), // MetaMask, etc.
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
});

