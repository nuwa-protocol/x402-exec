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
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { FacilitatorConfig, SettlementRouterParams } from "@x402x/core_v2";
import { SETTLEMENT_ROUTER_ABI } from "@x402x/core_v2";
import type { PaymentRequirements, PaymentPayload, SettleResponse } from "@x402/core/types";
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
  toCanonicalNetworkKey,
  getNetworkName,
  type NetworkConfig,
} from "@x402x/core_v2";

/**
 * Convert NetworkConfig to viem Chain
 * 
 * @param networkConfig - Network configuration
 * @param rpcUrl - RPC URL for the network
 * @returns viem Chain object
 */
function networkConfigToChain(networkConfig: NetworkConfig, rpcUrl: string): Chain {
  return {
    id: networkConfig.chainId,
    name: networkConfig.name,
    nativeCurrency: {
      name: networkConfig.metadata?.nativeToken || "ETH",
      symbol: networkConfig.metadata?.nativeToken || "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
    blockExplorers: {
      default: {
        name: "Explorer",
        url: networkConfig.addressExplorerBaseUrl.replace("/address/", ""),
      },
    },
    testnet: networkConfig.type === "testnet",
  };
}

/**
 * Create viem public client for a network
 *
 * @param network - Network identifier (V1 name or V2 CAIP-2 format)
 * @param rpcUrls - Optional custom RPC URLs
 */
export function createPublicClientForNetwork(
  network: string,
  rpcUrls?: Record<string, string>,
): PublicClient {
  // Normalize network identifier: any format -> CAIP-2 -> V1 name
  const canonicalNetwork = toCanonicalNetworkKey(network);
  const v1NetworkName = getNetworkName(canonicalNetwork);
  const networkConfig = getNetworkConfig(v1NetworkName);

  // Use provided RPC URL or require it to be provided
  const rpcUrl =
    rpcUrls?.[network] ||
    rpcUrls?.[v1NetworkName] ||
    rpcUrls?.[canonicalNetwork];

  if (!rpcUrl) {
    throw new Error(`No RPC URL available for network: ${network}. Please provide RPC URL in config.`);
  }

  const chain = networkConfigToChain(networkConfig, rpcUrl);

  return createPublicClient({
    chain,
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
  signer?: Address,
  rpcUrls?: Record<string, string>,
  transport?: Transport,
  privateKey?: string,
): WalletClient {
  // Normalize network identifier: any format -> CAIP-2 -> V1 name
  const canonicalNetwork = toCanonicalNetworkKey(network);
  const v1NetworkName = getNetworkName(canonicalNetwork);
  const networkConfig = getNetworkConfig(v1NetworkName);

  // Use provided RPC URL or require it to be provided
  const rpcUrl =
    rpcUrls?.[network] ||
    rpcUrls?.[v1NetworkName] ||
    rpcUrls?.[canonicalNetwork];

  if (!rpcUrl) {
    throw new Error(`No RPC URL available for network: ${network}. Please provide RPC URL in config.`);
  }

  // Validate that at least one of signer or privateKey is provided
  if (!signer && !privateKey) {
    throw new Error("Either signer or privateKey must be provided to create wallet client");
  }

  // Use private key for local signing if provided, otherwise use signer address
  let account: Account | Address;
  if (privateKey) {
    account = privateKeyToAccount(privateKey as Hex);
  } else if (signer) {
    account = signer;
  } else {
    // This should never happen due to the validation above
    throw new Error("Failed to create account: neither signer nor privateKey provided");
  }

  const chain = networkConfigToChain(networkConfig, rpcUrl);

  return createWalletClient({
    account,
    chain,
    transport: transport || http(rpcUrl),
  });
}

/**
 * Calculate gas limit for SettlementRouter transaction
 */
export function calculateGasLimit(
  baseFee: string,
  facilitatorFee: string,
  gasMultiplier: number = 1.2,
): bigint {
  validateGasMultiplier(gasMultiplier);

  // Base gas estimation for settleAndExecute
  const baseGas = 200000n; // Conservative estimate

  // Add gas for hook execution (if any)
  const hookGas = facilitatorFee !== "0x0" ? 100000n : 0n;

  // Calculate total with multiplier
  const totalGas = ((baseGas + hookGas) * BigInt(Math.ceil(gasMultiplier * 100))) / 100n;

  validateGasLimit(totalGas);
  return totalGas;
}

/**
 * Check if a settlement has already been executed
 */
export async function checkIfSettled(
  publicClient: PublicClient,
  router: Address,
  contextKey: Hex,
): Promise<boolean> {
  try {
    // Use type assertion because TypeScript can't properly infer the ABI function
    const isSettled = (await publicClient.readContract({
      address: router,
      abi: SETTLEMENT_ROUTER_ABI as any,
      functionName: "isSettled",
      args: [contextKey],
    })) as unknown as boolean;
    return isSettled;
  } catch (error) {
    throw new Error(
      `Failed to check settlement status: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
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
  } = {},
): Promise<Hex> {
  const gasLimit =
    config.gasLimit || calculateGasLimit("0x0", params.facilitatorFee, config.gasMultiplier);

  // Log params for debugging
  console.log("[executeSettlementWithRouter] Settlement params:", {
    token: params.token,
    from: params.from,
    value: params.value,
    validAfter: params.validAfter,
    validBefore: params.validBefore,
    nonce: params.nonce,
    signature: params.signature ? `${params.signature.slice(0, 10)}...` : undefined,
    salt: params.salt,
    payTo: params.payTo,
    facilitatorFee: params.facilitatorFee,
    hook: params.hook,
    hookData: params.hookData,
    settlementRouter: params.settlementRouter,
  });

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
      chain: walletClient.chain,
      account: walletClient.account ?? null,
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
  timeoutMs: number = 30000,
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
    throw new Error(
      `Failed to get transaction receipt: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * EVM Exact Scheme Authorization structure
 * Standard x402 v2 authorization format for EIP-3009
 */
interface ExactEvmAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

/**
 * EVM Exact Scheme Payload structure
 * Standard x402 v2 payload format
 */
interface ExactEvmPayload {
  signature: string;
  authorization: ExactEvmAuthorization;
}

/**
 * Parse EVM exact scheme payload from x402 v2 PaymentPayload
 * Extracts the standard authorization and signature fields
 */
function parseEvmExactPayload(payload: any): ExactEvmPayload {
  // x402 v2 uses payload.payload for scheme-specific data
  const evmPayload = payload.payload as ExactEvmPayload;
  
  if (!evmPayload || !evmPayload.signature || !evmPayload.authorization) {
    throw new Error("Invalid EVM exact payload structure");
  }
  
  return evmPayload;
}

/**
 * Parse settlement parameters from payment requirements and payload
 */
export function parseSettlementRouterParams(
  paymentRequirements: any,
  paymentPayload: any,
): SettlementRouterParams {
  if (!isSettlementMode(paymentRequirements)) {
    throw new Error("Payment requirements are not in SettlementRouter mode");
  }

  // Parse standard x402 v2 EVM exact payload
  const evmPayload = parseEvmExactPayload(paymentPayload);
  const extra = parseSettlementExtra(paymentRequirements.extra);

  return {
    token: paymentRequirements.asset as Address,
    from: evmPayload.authorization.from as Address,
    value: paymentRequirements.amount, // V2 uses 'amount', not 'maxAmountRequired'
    validAfter: evmPayload.authorization.validAfter || "0x0",
    validBefore: evmPayload.authorization.validBefore || "0xFFFFFFFFFFFFFFFF",
    nonce: evmPayload.authorization.nonce,
    signature: evmPayload.signature,
    salt: extra.salt,
    payTo: extra.payTo as Address,
    facilitatorFee: extra.facilitatorFee,
    hook: extra.hook as Address,
    hookData: extra.hookData,
    settlementRouter: extra.settlementRouter as Address,
  };
}

/**
 * Execute settlement using provided WalletClient (for AccountPool integration)
 * This function allows external wallet management by accepting a pre-configured WalletClient
 */
export async function executeSettlementWithWalletClient(
  walletClient: WalletClient,
  publicClient: PublicClient,
  paymentRequirements: PaymentRequirements,
  paymentPayload: PaymentPayload,
  config: {
    gasLimit?: bigint;
    gasMultiplier?: number;
    timeoutMs?: number;
    allowedRouters?: Record<string, string[]>;
  } = {},
): Promise<SettleResponse> {
  try {
    // Validate SettlementRouter
    // Normalize network identifier: any format -> CAIP-2 -> V1 name
    const canonicalNetwork = toCanonicalNetworkKey(paymentRequirements.network);
    const v1NetworkName = getNetworkName(canonicalNetwork);
    const networkConfig = getNetworkConfig(v1NetworkName);

    const settlementRouter = paymentRequirements.extra?.settlementRouter as string | undefined;
    if (!settlementRouter) {
      throw new Error("Missing settlementRouter in payment requirements");
    }

    validateSettlementRouter(
      paymentRequirements.network,
      settlementRouter as Address,
      config.allowedRouters,
      networkConfig,
    );

    // Parse settlement parameters
    const params = parseSettlementRouterParams(paymentRequirements, paymentPayload);

    // Execute settlement with provided wallet client
    const txHash = await executeSettlementWithRouter(walletClient, params, {
      gasLimit: config.gasLimit,
      gasMultiplier: config.gasMultiplier,
    });

    // Wait for receipt
    const receipt = await waitForSettlementReceipt(publicClient, txHash, config.timeoutMs || 30000);

    return {
      success: receipt.success,
      transaction: txHash,
      network: paymentRequirements.network,
      payer: params.from, // Use params.from for consistency
      errorReason: receipt.success ? undefined : "Transaction failed",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Extract payer consistently from params when possible
    let payer: string | undefined;
    try {
      const params = parseSettlementRouterParams(paymentRequirements, paymentPayload);
      payer = params.from;
    } catch (parseError) {
      console.error("[executeSettlementWithWalletClient] Failed to parse params:", parseError);
      // Try to extract from payload directly as fallback
      try {
        const evmPayload = parseEvmExactPayload(paymentPayload);
        payer = evmPayload.authorization.from;
      } catch {
        payer = undefined;
      }
    }

    // Log detailed error for debugging
    console.error("[executeSettlementWithWalletClient] Settlement failed:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      network: paymentRequirements.network,
      asset: paymentRequirements.asset,
      payer,
    });

    return {
      success: false,
      transaction: "",
      network: paymentRequirements.network,
      payer,
      errorReason: errorMessage,
    };
  }
}

/**
 * Full settlement workflow using SettlementRouter
 * This function creates its own clients based on FacilitatorConfig
 */
export async function settleWithSettlementRouter(
  paymentRequirements: any,
  paymentPayload: any,
  config: FacilitatorConfig,
  options: {
    gasMultiplier?: number;
    gasLimit?: bigint;
    timeoutMs?: number;
  } = {},
): Promise<SettleResponse> {
  try {
    // Validate configuration
    const networkConfig = getNetworkConfig(paymentRequirements.network);
    validateSettlementRouter(
      paymentRequirements.network,
      paymentRequirements.extra?.settlementRouter,
      config.allowedRouters,
      networkConfig,
    );

    // Parse settlement parameters
    const params = parseSettlementRouterParams(paymentRequirements, paymentPayload);

    // Create clients
    const publicClient = createPublicClientForNetwork(paymentRequirements.network, config.rpcUrls);
    const walletClient = createWalletClientForNetwork(
      paymentRequirements.network,
      config.signer,
      config.rpcUrls,
      undefined,
      config.privateKey,
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
      options.timeoutMs || 30000,
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
    
    // Extract payer from payload
    let payer: string | undefined;
    try {
      const evmPayload = parseEvmExactPayload(paymentPayload);
      payer = evmPayload.authorization.from;
    } catch {
      payer = undefined;
    }
    
    return {
      success: false,
      transaction: "",
      network: paymentRequirements.network,
      payer,
      errorReason: errorMessage,
    };
  }
}
