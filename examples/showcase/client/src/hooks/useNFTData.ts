/**
 * Hook to read NFT contract data from all networks
 *
 * Data is fetched once on mount and can be manually refreshed.
 * No automatic polling to avoid rate limiting.
 */

import { useState, useEffect, useCallback } from "react";
import { createPublicClient, http, type Address } from "viem";
import { NETWORKS, type Network } from "../config";
import { getNetworkConfig } from "@x402x/core";

const NFT_ABI = [
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "MAX_SUPPLY",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "remainingSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

// Helper function to get NFT address from core config
function getNFTAddress(network: string): string {
  try {
    return getNetworkConfig(network).demoHooks?.randomNFT || "0x0000000000000000000000000000000000000000";
  } catch {
    return "0x0000000000000000000000000000000000000000";
  }
}

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
    "base-sepolia": {
      network: "base-sepolia",
      totalSupply: 0,
      maxSupply: 0,
      remainingSupply: 0,
      loading: true,
      error: null,
    },
    "x-layer-testnet": {
      network: "x-layer-testnet",
      totalSupply: 0,
      maxSupply: 0,
      remainingSupply: 0,
      loading: true,
      error: null,
    },
    "skale-base-sepolia": {
      network: "skale-base-sepolia",
      totalSupply: 0,
      maxSupply: 0,
      remainingSupply: 0,
      loading: true,
      error: null,
    },
    base: {
      network: "base",
      totalSupply: 0,
      maxSupply: 0,
      remainingSupply: 0,
      loading: true,
      error: null,
    },
    "x-layer": {
      network: "x-layer",
      totalSupply: 0,
      maxSupply: 0,
      remainingSupply: 0,
      loading: true,
      error: null,
    },
  });

  const fetchDataForNetwork = useCallback(async (network: Network): Promise<NFTNetworkData> => {
    const nftAddress = getNFTAddress(network);
    const config = NETWORKS[network];

    // Check if address is configured
    if (!nftAddress || nftAddress === "0x0000000000000000000000000000000000000000") {
      return {
        network,
        totalSupply: 0,
        maxSupply: 0,
        remainingSupply: 0,
        loading: false,
        error: "Not deployed",
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
          functionName: "totalSupply",
        }),
        client.readContract({
          address: nftAddress as Address,
          abi: NFT_ABI,
          functionName: "MAX_SUPPLY",
        }),
        client.readContract({
          address: nftAddress as Address,
          abi: NFT_ABI,
          functionName: "remainingSupply",
        }),
      ]);

      console.log(
        `[useAllNetworksNFTData] ${network} - Total: ${totalSupply}, Max: ${maxSupply}, Remaining: ${remainingSupply}`,
      );

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
        error: "Failed to load",
      };
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    const results = await Promise.all(
      Object.keys(NETWORKS).map((network) => fetchDataForNetwork(network as Network)),
    );

    const newData = results.reduce(
      (acc, result) => {
        acc[result.network] = result;
        return acc;
      },
      {} as Record<Network, NFTNetworkData>,
    );

    setData(newData);
  }, [fetchDataForNetwork]);

  // Fetch data once on mount
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Return data and refresh function
  return { data, refresh: fetchAllData };
}
