/**
 * Network Balances Hook
 * Query USDC balances across multiple networks
 */

import { useState, useEffect } from 'react';
import { createPublicClient, http, Address, formatUnits } from 'viem';
import { NETWORKS, Network } from '../config';

// ERC-20 ABI for balanceOf
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

export interface NetworkBalance {
  network: Network;
  balance: string; // Formatted balance (e.g., "10.5")
  raw: bigint; // Raw balance
  loading: boolean;
  error: string | null;
}

/**
 * Query USDC balances across all supported networks
 */
export function useNetworkBalances(address: string | undefined) {
  const [balances, setBalances] = useState<Record<Network, NetworkBalance>>({
    'base-sepolia': {
      network: 'base-sepolia',
      balance: '0',
      raw: 0n,
      loading: true,
      error: null,
    },
    'x-layer-testnet': {
      network: 'x-layer-testnet',
      balance: '0',
      raw: 0n,
      loading: true,
      error: null,
    },
    'base': {
      network: 'base',
      balance: '0',
      raw: 0n,
      loading: true,
      error: null,
    },
    'x-layer': {
      network: 'x-layer',
      balance: '0',
      raw: 0n,
      loading: true,
      error: null,
    },
  });

  useEffect(() => {
    if (!address) {
      // Reset balances when no address
      setBalances({
        'base-sepolia': {
          network: 'base-sepolia',
          balance: '0',
          raw: 0n,
          loading: false,
          error: null,
        },
        'x-layer-testnet': {
          network: 'x-layer-testnet',
          balance: '0',
          raw: 0n,
          loading: false,
          error: null,
        },
        'base': {
          network: 'base',
          balance: '0',
          raw: 0n,
          loading: false,
          error: null,
        },
        'x-layer': {
          network: 'x-layer',
          balance: '0',
          raw: 0n,
          loading: false,
          error: null,
        },
      });
      return;
    }

    // Query balances for all networks in parallel
    const queries = Object.entries(NETWORKS).map(async ([networkKey, config]) => {
      const network = networkKey as Network;
      
      try {
        const client = createPublicClient({
          chain: config.chain,
          transport: http(),
        });

        const balance = await client.readContract({
          address: config.usdcAddress as Address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as Address],
        });

        return {
          network,
          balance: formatUnits(balance, 6), // USDC has 6 decimals
          raw: balance,
          loading: false,
          error: null,
        };
      } catch (error) {
        console.error(`[Balance] Failed to query ${network}:`, error);
        return {
          network,
          balance: '0',
          raw: 0n,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load balance',
        };
      }
    });

    Promise.all(queries).then((results) => {
      const newBalances = results.reduce((acc, result) => {
        acc[result.network] = result;
        return acc;
      }, {} as Record<Network, NetworkBalance>);
      
      setBalances(newBalances);
    });
  }, [address]);

  return balances;
}

