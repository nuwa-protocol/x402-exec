// Network and token metadata derived from @x402x/core
// We mirror the approach used in web/frontend/src/constants/facilitator.ts
// to keep network/token lists sourced from a single place.

import { getNetworkConfig, getSupportedNetworks } from '@x402x/core';

export type PaymentToken = {
  symbol: string;
  label: string;
  address: string;
  explorerUrl?: string;
};

export type SupportedNetwork = {
  name: string;
  network: string; // e.g. 'base', 'base-sepolia'
  chainId: number;
  status: 'Mainnet' | 'Testnet';
  settlementRouter: string;
  hookTransfer: string;
  explorerUrl: string; // direct link to the settlement router on an explorer
  // Optional base URL to view transactions for this network (e.g., https://basescan.org/tx/)
  txExplorerBaseUrl?: string;
  paymentTokens: PaymentToken[];
};

// Build supported payment tokens from the SDK's per-network config.
// Today each network supports a single USDC token.
export const SUPPORTED_PAYMENT_TOKENS: Record<string, PaymentToken[]> = (() => {
  const result: Record<string, PaymentToken[]> = {};
  for (const n of getSupportedNetworks()) {
    const cfg = getNetworkConfig(n);
    const addressBase = cfg.addressExplorerBaseUrl;
    const usdcAddress = cfg.usdc.address;

    result[n] = [
      {
        symbol: 'USDC',
        label: 'USDC',
        address: usdcAddress,
        explorerUrl: addressBase ? `${addressBase}${usdcAddress}` : undefined,
      },
    ];
  }
  return result;
})();

// Build supported networks list from SDK + meta config
export const SUPPORTED_NETWORKS: SupportedNetwork[] = (() => {
  const list: SupportedNetwork[] = [];
  for (const n of getSupportedNetworks()) {
    const cfg = getNetworkConfig(n);
    list.push({
      name: cfg.name ?? n,
      network: n,
      chainId: cfg.chainId,
      status: cfg.type === 'mainnet' ? 'Mainnet' : 'Testnet',
      settlementRouter: cfg.settlementRouter,
      hookTransfer: cfg.hooks.transfer,
      explorerUrl: cfg.addressExplorerBaseUrl
        ? `${cfg.addressExplorerBaseUrl}${cfg.settlementRouter}`
        : '',
      txExplorerBaseUrl: cfg.txExplorerBaseUrl,
      paymentTokens: SUPPORTED_PAYMENT_TOKENS[n] ?? [],
    });
  }
  return list;
})();

// Convenience map for quick lookup by network key
export const NETWORK_BY_KEY: Record<string, SupportedNetwork> = Object.fromEntries(
  SUPPORTED_NETWORKS.map((n) => [n.network, n]),
);
