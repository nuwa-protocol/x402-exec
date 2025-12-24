/**
 * SettlementRouter integration utilities for @x402x/facilitator_v2
 *
 * Provides direct viem integration with SettlementRouter contracts
 */

import type { Address, Hex } from "viem";
import {
  createPublicClient,
  createWalletClient,
  http,
  privateKeyToAccount,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
} from "viem";
import type { SettlementRouterParams, SettleResponse, FacilitatorConfig } from "./types.js";
import { SETTLEMENT_ROUTER_ABI } from "./types.js";
import {
  validateGasLimit,
  validateGasMultiplier,
  validateSettlementRouter,
  validateSettlementExtra,
} from "./validation.js";
import {
  isSettlementMode,
  parseSettlementExtra,
  getNetworkConfig,
  type NetworkConfig,
} from "@x402x/core_v2";

/**
 * Create viem public client for a network
 */
export function createPublicClientForNetwork(
  network: string,
  rpcUrls?: Record<string, string>
): PublicClient {
  const networkConfig = getNetworkConfig(network);

  // Use provided RPC URL or fallback to network config
  const rpcUrl = rpcUrls?.[network] || networkConfig?.rpcUrls?.default?.http?.[0];

  if (!rpcUrl) {
    throw new Error(`No RPC URL available for network: ${network}`);
  }

  return createPublicClient({
    chain: networkConfig as Chain,
    transport: http(rpcUrl),
  });
}

/**
 * Create viem wallet client for a network
 * If privateKey is provided, uses local signing (works with standard RPC providers)
 * If only signer address is provided, requires node to have the account unlocked
 */
export function createWalletClientForNetwork(
  network: string,
  signer: Address,
  rpcUrls?: Record<string, string>,
  transport?: Transport,
  privateKey?: string
): WalletClient {
  const networkConfig = getNetworkConfig(network);

  // Use provided RPC URL or fallback to network config
  const rpcUrl = rpcUrls?.[network] || networkConfig?.rpcUrls?.default?.http?.[0];

  if (!rpcUrl) {
    throw new Error(`No RPC URL available for network: ${network}`);
  }

  // Use private key for local signing if provided
  let account: Account | Address = signer;
  if (privateKey) {
    account = privateKeyToAccount(privateKey as Hex);
  }

  return createWalletClient({
    account,
    chain: networkConfig as Chain,
    transport: transport || http(rpcUrl),
  });
}

/**
 * Calculate gas limit for SettlementRouter transaction
 */
export function calculateGasLimit(
  baseFee: string,
  facilitatorFee: string,
  gasMultiplier: number = 1.2
): bigint {
  validateGasMultiplier(gasMultiplier);

  // Base gas estimation for settleAndExecute
  const baseGas = 200000n; // Conservative estimate

  // Add gas for hook execution (if any)
  const hookGas = facilitatorFee !== "0x0" ? 100000n : 0n;

  // Calculate total with multiplier
  const totalGas = (baseGas + hookGas) * BigInt(Math.ceil(gasMultiplier * 100)) / 100n;

  validateGasLimit(totalGas);
  return totalGas;
}

/**
 * Check if a settlement has already been executed
 */
export async function checkIfSettled(
  publicClient: PublicClient,
  router: Address,
  contextKey: Hex
): Promise<boolean> {
  try {
    const isSettled = await publicClient.readContract({
      address: router,
      abi: SETTLEMENT_ROUTER_ABI,
      functionName: "isSettled",
      args: [contextKey],
    });
    return isSettled;
  } catch (error) {
    throw new Error(`Failed to check settlement status: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Execute settlement via SettlementRouter
 */
export async function executeSettlementWithRouter(
  walletClient: WalletClient,
  params: SettlementRouterParams,
  config: {
    gasLimit?: bigint;
    gasMultiplier?: number;
  } = {}
): Promise<Hex> {
  const gasLimit = config.gasLimit || calculateGasLimit("0x0", params.facilitatorFee, config.gasMultiplier);

  try {
    const txHash = await walletClient.writeContract({
      address: params.settlementRouter,
      abi: SETTLEMENT_ROUTER_ABI,
      functionName: "settleAndExecute",
      args: [
        params.token,
        params.from,
        BigInt(params.value),
        BigInt(params.validAfter),
        BigInt(params.validBefore),
        params.nonce as Hex,
        params.signature as Hex,
        params.salt as Hex,
        params.payTo,
        BigInt(params.facilitatorFee),
        params.hook,
        params.hookData as Hex,
      ],
      gas: gasLimit,
    });

    return txHash;
  } catch (error) {
    if (error instanceof Error) {
      // Try to extract meaningful error information
      let errorMessage = `SettlementRouter execution failed: ${error.message}`;

      // Add context if available
      if ("cause" in error && error.cause) {
        errorMessage += ` (cause: ${error.cause})`;
      }

      throw new Error(errorMessage);
    }
    throw new Error("Unknown error during SettlementRouter execution");
  }
}

/**
 * Wait for transaction receipt and extract relevant data
 */
export async function waitForSettlementReceipt(
  publicClient: PublicClient,
  txHash: Hex,
  timeoutMs: number = 30000
): Promise<{
  success: boolean;
  blockNumber?: bigint;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
}> {
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: timeoutMs,
    });

    return {
      success: receipt.status === "success",
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
    };
  } catch (error) {
    throw new Error(`Failed to get transaction receipt: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Parse settlement parameters from payment requirements and payload
 */
export function parseSettlementRouterParams(
  paymentRequirements: any,
  paymentPayload: any
): SettlementRouterParams {
  if (!isSettlementMode(paymentRequirements)) {
    throw new Error("Payment requirements are not in SettlementRouter mode");
  }

  const extra = parseSettlementExtra(paymentRequirements.extra);

  return {
    token: paymentRequirements.asset as Address,
    from: paymentPayload.payer as Address,
    value: paymentRequirements.maxAmountRequired,
    validAfter: paymentPayload.validAfter || "0x0",
    validBefore: paymentPayload.validBefore || "0xFFFFFFFFFFFFFFFF",
    nonce: paymentPayload.nonce,
    signature: paymentPayload.signature,
    salt: extra.salt,
    payTo: extra.payTo as Address,
    facilitatorFee: extra.facilitatorFee,
    hook: extra.hook as Address,
    hookData: extra.hookData,
    settlementRouter: extra.settlementRouter as Address,
  };
}

/**
 * Full settlement workflow using SettlementRouter
 */
export async function settleWithSettlementRouter(
  paymentRequirements: any,
  paymentPayload: any,
  config: FacilitatorConfig,
  options: {
    gasMultiplier?: number;
    gasLimit?: bigint;
    timeoutMs?: number;
  } = {}
): Promise<SettleResponse> {
  try {
    // Validate configuration
    const networkConfig = getNetworkConfig(paymentRequirements.network);
    validateSettlementRouter(
      paymentRequirements.network,
      paymentRequirements.extra?.settlementRouter,
      config.allowedRouters,
      networkConfig
    );

    // Parse settlement parameters
    const params = parseSettlementRouterParams(paymentRequirements, paymentPayload);

    // Create clients
    const publicClient = createPublicClientForNetwork(
      paymentRequirements.network,
      config.rpcUrls
    );
    const walletClient = createWalletClientForNetwork(
      paymentRequirements.network,
      config.signer || "",
      config.rpcUrls,
      undefined,
      config.privateKey
    );

    // Execute settlement
    const txHash = await executeSettlementWithRouter(walletClient, params, {
      gasLimit: options.gasLimit,
      gasMultiplier: options.gasMultiplier,
    });

    // Wait for receipt
    const receipt = await waitForSettlementReceipt(
      publicClient,
      txHash,
      options.timeoutMs || 30000
    );

    return {
      success: receipt.success,
      transaction: txHash,
      network: paymentRequirements.network,
      payer: params.from,
      errorReason: receipt.success ? undefined : "Transaction failed",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      transaction: "",
      network: paymentRequirements.network,
      payer: paymentPayload.payer,
      errorReason: errorMessage,
    };
  }
}