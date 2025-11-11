/**
 * Hook to read NFT contract data from all networks
 */

import { useState, useEffect } from 'react';
import { createPublicClient, http, type Address } from 'viem';
import { NETWORKS, type Network } from '../config';

const NFT_ABI = [
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'MAX_SUPPLY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'remainingSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// Get NFT addresses from environment (matching NFTMintHook.ts pattern)
const NFT_ADDRESSES: Record<string, string> = {
  'base-sepolia': import.meta.env.VITE_BASE_SEPOLIA_RANDOM_NFT_ADDRESS || '0x0000000000000000000000000000000000000000',
  'x-layer-testnet': import.meta.env.VITE_X_LAYER_TESTNET_RANDOM_NFT_ADDRESS || '0x0000000000000000000000000000000000000000',
};

export interface NFTNetworkData {
  network: Network;
  totalSupply: number;
  maxSupply: number;
  remainingSupply: number;
  loading: boolean;
  error: string | null;
}

export function useAllNetworksNFTData() {
  const [data, setData] = useState<Record<Network, NFTNetworkData>>({
    'base-sepolia': {
      network: 'base-sepolia',
      totalSupply: 0,
      maxSupply: 0,
      remainingSupply: 0,
      loading: true,
      error: null,
    },
    'x-layer-testnet': {
      network: 'x-layer-testnet',
      totalSupply: 0,
      maxSupply: 0,
      remainingSupply: 0,
      loading: true,
      error: null,
    },
  });

  useEffect(() => {
    let cancelled = false;

    const fetchDataForNetwork = async (network: Network): Promise<NFTNetworkData> => {
      const nftAddress = NFT_ADDRESSES[network];
      const config = NETWORKS[network];

      // Check if address is configured
      if (!nftAddress || nftAddress === '0x0000000000000000000000000000000000000000') {
        return {
          network,
          totalSupply: 0,
          maxSupply: 0,
          remainingSupply: 0,
          loading: false,
          error: 'Not deployed',
        };
      }

      try {
        const client = createPublicClient({
          chain: config.chain,
          transport: http(),
        });

        console.log(`[useAllNetworksNFTData] Fetching data for ${network} from ${nftAddress}`);

        const [totalSupply, maxSupply, remainingSupply] = await Promise.all([
          client.readContract({
            address: nftAddress as Address,
            abi: NFT_ABI,
            functionName: 'totalSupply',
          }),
          client.readContract({
            address: nftAddress as Address,
            abi: NFT_ABI,
            functionName: 'MAX_SUPPLY',
          }),
          client.readContract({
            address: nftAddress as Address,
            abi: NFT_ABI,
            functionName: 'remainingSupply',
          }),
        ]);

        console.log(`[useAllNetworksNFTData] ${network} - Total: ${totalSupply}, Max: ${maxSupply}, Remaining: ${remainingSupply}`);

        return {
          network,
          totalSupply: Number(totalSupply),
          maxSupply: Number(maxSupply),
          remainingSupply: Number(remainingSupply),
          loading: false,
          error: null,
        };
      } catch (error) {
        console.error(`[useAllNetworksNFTData] Failed to fetch NFT data for ${network}:`, error);
        return {
          network,
          totalSupply: 0,
          maxSupply: 0,
          remainingSupply: 0,
          loading: false,
          error: 'Failed to load',
        };
      }
    };

    const fetchAllData = async () => {
      const results = await Promise.all(
        Object.keys(NETWORKS).map(network => fetchDataForNetwork(network as Network))
      );

      if (!cancelled) {
        const newData = results.reduce((acc, result) => {
          acc[result.network] = result;
          return acc;
        }, {} as Record<Network, NFTNetworkData>);
        
        setData(newData);
      }
    };

    fetchAllData();

    // Refresh every 10 seconds
    const interval = setInterval(fetchAllData, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return data;
}
