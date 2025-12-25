/**
 * Hook to read RewardToken contract data from all networks
 *
 * Data is fetched once on mount and can be manually refreshed.
 * No automatic polling to avoid rate limiting.
 */

import { useState, useEffect, useCallback } from "react";
import { createPublicClient, http, formatUnits, type Address } from "viem";
import { NETWORKS, type Network } from "../config";
import { getNetworkConfig } from "@x402x/extensions";

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "remainingRewards",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

// Helper function to get reward token address from core config
function getRewardTokenAddress(network: string): string {
  try {
    return getNetworkConfig(network).demoHooks?.rewardToken || "0x0000000000000000000000000000000000000000";
  } catch {
    return "0x0000000000000000000000000000000000000000";
  }
}

export interface RewardTokenNetworkData {
  network: Network;
  userBalance: string; // Formatted with decimals
  contractBalance: string; // Remaining tokens in contract (from remainingRewards())
  totalSupply: string; // Total supply (should be 1,000,000)
  loading: boolean;
  error: string | null;
}

export function useAllNetworksRewardTokenData(userAddress?: Address) {
  const [data, setData] = useState<Record<Network, RewardTokenNetworkData>>({
    "base-sepolia": {
      network: "base-sepolia",
      userBalance: "0",
      contractBalance: "0",
      totalSupply: "0",
      loading: true,
      error: null,
    },
    "x-layer-testnet": {
      network: "x-layer-testnet",
      userBalance: "0",
      contractBalance: "0",
      totalSupply: "0",
      loading: true,
      error: null,
    },
    "skale-base-sepolia": {
      network: "skale-base-sepolia",
      userBalance: "0",
      contractBalance: "0",
      totalSupply: "0",
      loading: true,
      error: null,
    },
    base: {
      network: "base",
      userBalance: "0",
      contractBalance: "0",
      totalSupply: "0",
      loading: true,
      error: null,
    },
    "x-layer": {
      network: "x-layer",
      userBalance: "0",
      contractBalance: "0",
      totalSupply: "0",
      loading: true,
      error: null,
    },
  });

  const fetchDataForNetwork = useCallback(
    async (network: Network): Promise<RewardTokenNetworkData> => {
      const tokenAddress = getRewardTokenAddress(network);
      const config = NETWORKS[network];

      // Check if address is configured
      if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
        return {
          network,
          userBalance: "0",
          contractBalance: "0",
          totalSupply: "0",
          loading: false,
          error: "Not deployed",
        };
      }

      try {
        const client = createPublicClient({
          chain: config.chain,
          transport: http(),
        });

        console.log(
          `[useAllNetworksRewardTokenData] Fetching data for ${network} from ${tokenAddress}`,
        );

        // Fetch user balance if address provided
        const userBalancePromise = userAddress
          ? client.readContract({
              address: tokenAddress as Address,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [userAddress],
            })
          : Promise.resolve(0n);

        const [userBalanceRaw, totalSupplyRaw, remainingRewardsRaw] = await Promise.all([
          userBalancePromise,
          client.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: "totalSupply",
          }),
          client.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: "remainingRewards",
          }),
        ]);

        console.log(
          `[useAllNetworksRewardTokenData] ${network} - User: ${userBalanceRaw}, Total: ${totalSupplyRaw}, Remaining: ${remainingRewardsRaw}`,
        );

        return {
          network,
          userBalance: formatUnits(userBalanceRaw, 18),
          contractBalance: formatUnits(remainingRewardsRaw, 18),
          totalSupply: formatUnits(totalSupplyRaw, 18),
          loading: false,
          error: null,
        };
      } catch (error) {
        console.error(
          `[useAllNetworksRewardTokenData] Failed to fetch token data for ${network}:`,
          error,
        );
        return {
          network,
          userBalance: "0",
          contractBalance: "0",
          totalSupply: "0",
          loading: false,
          error: "Failed to load",
        };
      }
    },
    [userAddress],
  );

  const fetchAllData = useCallback(async () => {
    const results = await Promise.all(
      Object.keys(NETWORKS).map((network) => fetchDataForNetwork(network as Network)),
    );

    const newData = results.reduce(
      (acc, result) => {
        acc[result.network] = result;
        return acc;
      },
      {} as Record<Network, RewardTokenNetworkData>,
    );

    setData(newData);
  }, [fetchDataForNetwork]);

  // Fetch data once on mount, and re-fetch when userAddress changes
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Return data and refresh function
  return { data, refresh: fetchAllData };
}
