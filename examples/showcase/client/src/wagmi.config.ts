/**
 * Auto-generated Wagmi configuration
 * Automatically supports all networks from @x402x/extensions
 */

import { http, createConfig } from "wagmi";
import { getSupportedNetworkNames, getNetworkId } from "@x402x/extensions";
import { injected, metaMask, coinbaseWallet } from "wagmi/connectors";
import { defineChain, type Chain } from "viem";
import * as allChains from "viem/chains";

// Custom chain definitions for networks not in viem's standard list
const customChains: Record<number, Chain> = {
  // X Layer Testnet
  1952: defineChain({
    id: 1952,
    name: "X Layer Testnet",
    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://testrpc.xlayer.tech"] },
    },
    blockExplorers: {
      default: { name: "OKLink", url: "https://www.oklink.com/xlayer-test" },
    },
    testnet: true,
  }),
  // SKALE Nebula Testnet (Base Sepolia)
  324705682: defineChain({
    id: 324705682,
    name: "SKALE Nebula Testnet",
    nativeCurrency: { name: "sFUEL", symbol: "sFUEL", decimals: 18 },
    rpcUrls: {
      default: {
        http: ["https://testnet.skalenodes.com/v1/lanky-ill-funny-testnet"],
      },
    },
    blockExplorers: {
      default: {
        name: "SKALE Explorer",
        url: "https://lanky-ill-funny-testnet.explorer.testnet.skalenodes.com",
      },
    },
    testnet: true,
  }),
  // X Layer Mainnet
  196: defineChain({
    id: 196,
    name: "X Layer",
    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://rpc.xlayer.tech"] },
    },
    blockExplorers: {
      default: { name: "OKLink", url: "https://www.oklink.com/xlayer" },
    },
    testnet: false,
  }),
};

// Helper function to get viem chain from network name
function getChainFromNetwork(network: string): Chain {
  // Get the CAIP-2 network ID first (e.g., "base-sepolia" -> "eip155:84532")
  const networkId = getNetworkId(network);
  const chainId = parseInt(networkId.split(":")[1]);

  // Check custom chains first
  if (customChains[chainId]) {
    return customChains[chainId];
  }

  // Then check viem's standard chains
  const chain = Object.values(allChains).find((c) => c.id === chainId);
  if (!chain) {
    throw new Error(
      `Unsupported network: ${network} (chain ID: ${chainId}). ` +
        `Please add custom chain definition in wagmi.config.ts`,
    );
  }
  return chain;
}

// Auto-generate chains array from @x402x/extensions
const supportedNetworks = getSupportedNetworkNames();
const chains = supportedNetworks.map((network) => getChainFromNetwork(network));

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
