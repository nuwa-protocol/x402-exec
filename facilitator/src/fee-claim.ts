/**
 * Fee Claim Module
 *
 * Handles querying and claiming accumulated facilitator fees from SettlementRouter contracts.
 */

import type { PoolManager } from "./pool-manager.js";
import { isEvmSignerWallet } from "x402/types";
import { getLogger } from "./telemetry.js";
import { getNetworkConfig } from "@x402x/extensions"; // Use extensions version for v2 CAIP-2 support
import { SETTLEMENT_ROUTER_ABI } from "@x402x/core";
import type { Address, Hex } from "viem";
import { getConfigForNetwork, normalizeNetwork } from "./network-id.js";

const logger = getLogger();

/**
 * Configuration for fee claiming
 */
export interface FeeClaimConfig {
  /** Minimum claim amount per token (token address => amount) */
  minClaimAmount: Record<string, bigint>;
}

/**
 * Pending fee information for a specific network and token
 */
export interface PendingFee {
  /** Network name */
  network: string;
  /** SettlementRouter contract address */
  router: string;
  /** Token contract address */
  token: string;
  /** Facilitator address */
  facilitator: string;
  /** Pending amount in token's smallest unit */
  amount: bigint;
  /** Pending amount in USD (if price available) */
  amountUSD?: string;
}

/**
 * Fee claim request
 */
export interface ClaimFeesRequest {
  /** Networks to claim from (optional, claims from all if not provided) */
  networks?: string[];
  /** Tokens to claim (optional, claims all eligible tokens if not provided) */
  tokens?: string[];
}

/**
 * Result of a single claim operation
 */
export interface ClaimResult {
  /** Network name */
  network: string;
  /** Token address */
  token: string;
  /** Amount claimed */
  amount: bigint;
  /** Transaction hash */
  transaction: string;
  /** Status */
  status: "success" | "skipped" | "failed";
  /** Error message if failed */
  error?: string;
}

/**
 * Response for fee claiming operation
 */
export interface ClaimFeesResponse {
  /** Overall success status */
  success: boolean;
  /** Individual claim results */
  claims: ClaimResult[];
  /** Total claimed amount across all networks/tokens */
  totalClaimed: bigint;
}

/**
 * Query pending fees across all supported networks and tokens
 *
 * @param poolManager - Account pool manager to get facilitator addresses
 * @param allowedRouters - Whitelist of allowed SettlementRouter addresses per network
 * @param config - Fee claim configuration
 * @param networks - Optional: filter by specific networks
 * @returns Array of pending fee information
 */
export async function getPendingFees(
  poolManager: PoolManager,
  allowedRouters: Record<string, string[]>,
  config: FeeClaimConfig,
  networks?: string[],
): Promise<PendingFee[]> {
  const pendingFees: PendingFee[] = [];

  // Get all supported networks or filter by provided networks
  const targetNetworks = networks || Array.from(poolManager.getEvmAccountPools().keys());

  logger.debug({ targetNetworks, allowedRouters }, "Starting pending fees query");

  for (const network of targetNetworks) {
    try {
      const pool = poolManager.getPool(network);
      if (!pool) {
        logger.warn({ network }, "No account pool available for network, skipping");
        continue;
      }

      // Get SettlementRouter address for this network (with v1/v2 fallback)
      const lookup = getConfigForNetwork(allowedRouters, network);
      const routerAddress = lookup.value?.[0]; // Use first router in whitelist
      if (!routerAddress) {
        const normalized = normalizeNetwork(network);
        logger.warn(
          { network, canonical: normalized.canonical, alias: normalized.aliasV1 },
          "No SettlementRouter configured for network, skipping"
        );
        continue;
      }

      // Get all facilitator addresses from account pool
      const accountInfos = pool.getAccountsInfo();
      const facilitatorAddresses = accountInfos.map((info) => info.address);

      // Get network configuration to determine supported tokens
      const networkConfig = getNetworkConfig(network);
      const supportedTokens = [networkConfig.defaultAsset.address]; // Currently only USDC is supported

      // Query pending fees for each facilitator address and supported token
      for (const facilitatorAddress of facilitatorAddresses) {
        for (const tokenAddress of supportedTokens) {
          try {
            const amount = await pool.execute(async (signer) => {
              if (!isEvmSignerWallet(signer)) {
                throw new Error("Fee claiming requires EVM signer");
              }

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const publicClient = signer as any;
              if (!publicClient.readContract) {
                throw new Error("Signer must have readContract method");
              }

              return (await publicClient.readContract({
                address: routerAddress as Address,
                abi: SETTLEMENT_ROUTER_ABI,
                functionName: "getPendingFees",
                args: [facilitatorAddress as Address, tokenAddress as Address],
              })) as bigint;
            });

            // Apply minimum threshold
            const minAmount = config.minClaimAmount[tokenAddress] || 0n;
            if (amount >= minAmount && amount > 0n) {
              pendingFees.push({
                network,
                router: routerAddress,
                token: tokenAddress,
                facilitator: facilitatorAddress,
                amount,
              });
            }
          } catch (error) {
            logger.warn(
              {
                error,
                network,
                router: routerAddress,
                token: tokenAddress,
                facilitator: facilitatorAddress,
              },
              "Failed to query pending fees for facilitator and token",
            );
          }
        }
      }
    } catch (error) {
      logger.error({ error, network }, "Failed to query pending fees for network");
    }
  }

  logger.info(
    {
      networks: targetNetworks.length,
      pendingFees: pendingFees.length,
      totalAmount: pendingFees.reduce((sum, fee) => sum + fee.amount, 0n).toString(),
    },
    "Queried pending fees across networks",
  );

  return pendingFees;
}

/**
 * Claim accumulated fees from SettlementRouter contracts
 *
 * @param poolManager - Account pool manager
 * @param allowedRouters - Whitelist of allowed SettlementRouter addresses per network
 * @param config - Fee claim configuration
 * @param request - Claim request parameters
 * @returns Claim operation results
 */
export async function claimFees(
  poolManager: PoolManager,
  allowedRouters: Record<string, string[]>,
  config: FeeClaimConfig,
  request: ClaimFeesRequest = {},
): Promise<ClaimFeesResponse> {
  const results: ClaimResult[] = [];
  let totalClaimed = 0n;

  // Get pending fees first to determine what to claim
  const pendingFees = await getPendingFees(poolManager, allowedRouters, config, request.networks);

  // Group by facilitator address and network for claiming
  const feesByFacilitatorAndNetwork = new Map<string, Map<string, PendingFee[]>>();
  for (const fee of pendingFees) {
    const key = `${fee.facilitator}:${fee.network}`;
    if (!feesByFacilitatorAndNetwork.has(key)) {
      feesByFacilitatorAndNetwork.set(key, new Map());
    }
    const networkMap = feesByFacilitatorAndNetwork.get(key)!;
    if (!networkMap.has(fee.token)) {
      networkMap.set(fee.token, []);
    }
    networkMap.get(fee.token)!.push(fee);
  }

  // Filter tokens if specified
  const requestedTokens = request.tokens?.map((addr) => addr.toLowerCase());
  const eligibleFees = pendingFees.filter((fee) => {
    if (!requestedTokens) return true;
    return requestedTokens.includes(fee.token.toLowerCase());
  });

  // Claim fees facilitator by facilitator, network by network
  for (const [facilitatorNetworkKey, tokenMap] of feesByFacilitatorAndNetwork) {
    const [facilitatorAddress, network] = facilitatorNetworkKey.split(":");

    try {
      const pool = poolManager.getPool(network);
      if (!pool) {
        logger.warn({ network }, "No account pool available for network");
        continue;
      }

      // Get token addresses that this facilitator has fees for in this network
      const tokenAddresses: string[] = [];
      for (const [tokenAddress, fees] of tokenMap) {
        // Check if this facilitator has eligible fees for this token
        const hasEligibleFees = fees.some((fee) =>
          eligibleFees.some(
            (ef) => ef.facilitator === facilitatorAddress && ef.token === tokenAddress,
          ),
        );
        if (hasEligibleFees) {
          tokenAddresses.push(tokenAddress);
        }
      }

      if (tokenAddresses.length === 0) {
        logger.debug(
          { network, facilitator: facilitatorAddress },
          "No eligible tokens to claim for facilitator and network",
        );
        continue;
      }

      // Get router address from the fees
      const routerAddress = Array.from(tokenMap.values())[0][0].router;

      // Calculate total amount being claimed for this facilitator and network
      const totalAmount = Array.from(tokenMap.values())
        .flat()
        .reduce((sum, fee) => sum + fee.amount, 0n);

      // For now, we use pool.execute which will select an account.
      // In the future, we might need to modify AccountPool to allow specifying which account to use.
      // Since the claimFees function transfers to msg.sender, using any account from the pool
      // will work correctly - the fees will be transferred to whichever account executes the transaction.

      const txHash = await pool.execute(async (signer) => {
        if (!isEvmSignerWallet(signer)) {
          throw new Error("Fee claiming requires EVM signer");
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const walletClient = signer as any;
        if (!walletClient.writeContract) {
          throw new Error("Signer must have writeContract method");
        }

        try {
          const tx = await walletClient.writeContract({
            address: routerAddress as Address,
            abi: SETTLEMENT_ROUTER_ABI,
            functionName: "claimFees",
            args: [tokenAddresses as Address[]],
          });

          return tx as Hex;
        } catch (viemError: any) {
          // Extract meaningful error message from viem error
          const errorMessage =
            viemError?.shortMessage || viemError?.message || "Unknown transaction error";
          const errorDetails = viemError?.details || "";

          logger.warn(
            {
              error: viemError,
              network,
              facilitator: facilitatorAddress,
              router: routerAddress,
              tokens: tokenAddresses,
            },
            `Transaction failed: ${errorMessage}`,
          );

          throw new Error(`${errorMessage}${errorDetails ? ` (${errorDetails})` : ""}`);
        }
      });

      // Wait for transaction confirmation
      await pool.execute(async (signer) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const publicClient = signer as any;
        if (!publicClient.waitForTransactionReceipt) {
          throw new Error("Signer must have waitForTransactionReceipt method");
        }

        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          if (receipt.status !== "success") {
            throw new Error(`Transaction failed: ${txHash}`);
          }
          return receipt;
        } catch (viemError: any) {
          // Extract meaningful error message from viem error
          const errorMessage =
            viemError?.shortMessage || viemError?.message || "Unknown confirmation error";
          const errorDetails = viemError?.details || "";

          logger.warn(
            {
              error: viemError,
              network,
              facilitator: facilitatorAddress,
              transaction: txHash,
            },
            `Transaction confirmation failed: ${errorMessage}`,
          );

          throw new Error(`${errorMessage}${errorDetails ? ` (${errorDetails})` : ""}`);
        }
      });

      // Record successful claims for all fees in this facilitator-network group
      totalClaimed += totalAmount;

      for (const [tokenAddress, fees] of tokenMap) {
        for (const fee of fees) {
          if (
            eligibleFees.some(
              (ef) => ef.facilitator === facilitatorAddress && ef.token === tokenAddress,
            )
          ) {
            results.push({
              network,
              token: tokenAddress,
              amount: fee.amount,
              transaction: txHash,
              status: "success",
            });
          }
        }
      }

      logger.info(
        {
          network,
          facilitator: facilitatorAddress,
          tokens: tokenAddresses.length,
          totalAmount: totalAmount.toString(),
          transaction: txHash,
        },
        "Successfully claimed fees for facilitator and network",
      );
    } catch (error) {
      logger.error(
        { error, network, facilitator: facilitatorAddress },
        "Failed to claim fees for facilitator and network",
      );

      // Record failed claims for all fees in this facilitator-network group
      for (const [tokenAddress, fees] of tokenMap) {
        for (const fee of fees) {
          if (
            eligibleFees.some(
              (ef) => ef.facilitator === facilitatorAddress && ef.token === tokenAddress,
            )
          ) {
            results.push({
              network,
              token: tokenAddress,
              amount: fee.amount,
              transaction: "",
              status: "failed",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      }
    }
  }

  const success = results.every((result) => result.status === "success") && results.length > 0;

  // Count unique networks
  const uniqueNetworks = new Set(results.map((r) => r.network));

  logger.info(
    {
      success,
      networks: uniqueNetworks.size,
      claims: results.length,
      totalClaimed: totalClaimed.toString(),
    },
    "Completed fee claiming operation",
  );

  return {
    success,
    claims: results,
    totalClaimed,
  };
}
