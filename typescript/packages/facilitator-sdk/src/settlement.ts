/**
 * SettlementRouter integration utilities for @x402x/facilitator-sdk
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
import type { FacilitatorConfig, SettlementRouterParams } from "@x402x/extensions";
import { SETTLEMENT_ROUTER_ABI } from "@x402x/extensions";
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
  getNetworkAlias,
  type NetworkConfig,
} from "@x402x/extensions";

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
        url: (() => {
          const addressSuffix = "/address/";
          const baseUrl = networkConfig.addressExplorerBaseUrl;
          return baseUrl.endsWith(addressSuffix)
            ? baseUrl.slice(0, -addressSuffix.length)
            : baseUrl;
        })(),
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
  const v1NetworkAlias = getNetworkAlias(canonicalNetwork);
  const networkConfig = getNetworkConfig(v1NetworkAlias);

  if (!networkConfig) {
    throw new Error(`Network configuration not found for network: ${network}`);
  }

  // Use provided RPC URL or require it to be provided
  const rpcUrl =
    rpcUrls?.[network] ||
    rpcUrls?.[v1NetworkAlias] ||
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
  const v1NetworkAlias = getNetworkAlias(canonicalNetwork);
  const networkConfig = getNetworkConfig(v1NetworkAlias);

  // Use provided RPC URL or require it to be provided
  const rpcUrl =
    rpcUrls?.[network] ||
    rpcUrls?.[v1NetworkAlias] ||
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
  // Treat both "0" and "0x0" (and any numeric zero) as no-fee.
  const hookGas = BigInt(facilitatorFee) === 0n ? 0n : 100000n;

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
    const isSettled = await publicClient.readContract({
      address: router,
      abi: SETTLEMENT_ROUTER_ABI,
      functionName: "isSettled",
      args: [contextKey],
    });
    return isSettled;
  } catch (error) {
    throw new Error(
      `Failed to check settlement status: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * ERC20 ABI for balance checks
 */
const ERC20_ABI = [
  {
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ type: "uint256" }],
  },
] as const;

/**
 * Execute settlement via SettlementRouter
 */
export async function executeSettlementWithRouter(
  walletClient: WalletClient,
  params: SettlementRouterParams,
  config: {
    gasLimit?: bigint;
    gasMultiplier?: number;
    publicClient?: PublicClient;
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

  // Check user balance before sending transaction to avoid wasting gas
  if (config.publicClient) {
    try {
      const balance = await config.publicClient.readContract({
        address: params.token,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [params.from],
      });

      const requiredAmount = BigInt(params.value) + BigInt(params.facilitatorFee);
      if (balance < requiredAmount) {
        throw new Error(
          `Insufficient balance: user has ${balance} tokens, but needs ${requiredAmount} ` +
          `(payment: ${params.value} + facilitator fee: ${params.facilitatorFee})`
        );
      }
    } catch (error) {
      // If balance check fails, log the error but continue with transaction
      // The transaction will fail on-chain with a more specific error if balance is truly insufficient
      if (error instanceof Error && !error.message.includes("Insufficient balance")) {
        console.warn("[executeSettlementWithRouter] Balance check failed, proceeding with transaction:", error.message);
      } else {
        // Re-throw the insufficient balance error
        throw error;
      }
    }
  }

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
 * Parse x402x router settlement extension from v2 PaymentPayload.extensions
 * 
 * @param extensions - PaymentPayload.extensions object
 * @returns Router settlement info or undefined if not present
 */
function parseRouterSettlementFromExtensions(extensions: Record<string, unknown> | undefined): {
  salt: string;
  settlementRouter: string;
  hook: string;
  hookData: string;
  finalPayTo: string;
  facilitatorFee: string;
} | undefined {
  if (!extensions || typeof extensions !== "object") {
    return undefined;
  }

  const ROUTER_SETTLEMENT_KEY = "x402x-router-settlement";
  const routerSettlement = extensions[ROUTER_SETTLEMENT_KEY];
  
  if (!routerSettlement || typeof routerSettlement !== "object") {
    return undefined;
  }

  const info = (routerSettlement as any).info;
  if (!info || typeof info !== "object") {
    return undefined;
  }

  // Validate and extract all required fields
  if (
    typeof info.salt !== "string" ||
    typeof info.settlementRouter !== "string" ||
    typeof info.hook !== "string" ||
    typeof info.hookData !== "string" ||
    typeof info.finalPayTo !== "string"
  ) {
    return undefined;
  }

  // facilitatorFee is optional; default to "0" when omitted
  const facilitatorFee =
    typeof (info as any).facilitatorFee === "string" ? (info as any).facilitatorFee : "0";

  return {
    salt: info.salt,
    settlementRouter: info.settlementRouter,
    hook: info.hook,
    hookData: info.hookData,
    finalPayTo: info.finalPayTo,
    facilitatorFee,
  };
}

/**
 * Parse settlement parameters from payment requirements and payload
 * 
 * v2 behavior: Read from paymentPayload.extensions["x402x-router-settlement"].info first,
 * fallback to paymentRequirements.extra for legacy compatibility.
 */
export function parseSettlementRouterParams(
  paymentRequirements: any,
  paymentPayload: any,
): SettlementRouterParams {
  // Parse standard x402 v2 EVM exact payload
  const evmPayload = parseEvmExactPayload(paymentPayload);

  // Try v2 extensions first (paymentPayload.extensions["x402x-router-settlement"])
  const extensionParams = parseRouterSettlementFromExtensions(paymentPayload.extensions);
  
  if (extensionParams) {
    // v2 path: all params from extensions
    return {
      token: paymentRequirements.asset as Address,
      from: evmPayload.authorization.from as Address,
      value: paymentRequirements.amount,
      validAfter: evmPayload.authorization.validAfter || "0x0",
      validBefore: evmPayload.authorization.validBefore || "0xFFFFFFFFFFFFFFFF",
      nonce: evmPayload.authorization.nonce,
      signature: evmPayload.signature,
      salt: extensionParams.salt,
      payTo: extensionParams.finalPayTo as Address,
      facilitatorFee: extensionParams.facilitatorFee,
      hook: extensionParams.hook as Address,
      hookData: extensionParams.hookData,
      settlementRouter: extensionParams.settlementRouter as Address,
    };
  }

  // Fallback: legacy mode (read from requirements.extra)
  if (!isSettlementMode(paymentRequirements)) {
    throw new Error(
      "x402x router settlement parameters not found. " +
      "Expected paymentPayload.extensions['x402x-router-settlement'].info (v2) or " +
      "paymentRequirements.extra.settlementRouter (legacy)."
    );
  }

  const extra = parseSettlementExtra(paymentRequirements.extra);

  return {
    token: paymentRequirements.asset as Address,
    from: evmPayload.authorization.from as Address,
    value: paymentRequirements.amount,
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
    // Parse settlement parameters (reads from paymentPayload.extensions or requirements.extra)
    const params = parseSettlementRouterParams(paymentRequirements, paymentPayload);

    // Validate SettlementRouter
    // Normalize network identifier: any format -> CAIP-2 -> V1 name
    const canonicalNetwork = toCanonicalNetworkKey(paymentRequirements.network);
    const v1NetworkAlias = getNetworkAlias(canonicalNetwork);
    const networkConfig = getNetworkConfig(v1NetworkAlias);

    validateSettlementRouter(
      paymentRequirements.network,
      params.settlementRouter,
      config.allowedRouters,
      networkConfig,
    );

    // Execute settlement with provided wallet client
    const txHash = await executeSettlementWithRouter(walletClient, params, {
      gasLimit: config.gasLimit,
      gasMultiplier: config.gasMultiplier,
      publicClient,
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
    // Parse settlement parameters (reads from extensions or extra)
    const params = parseSettlementRouterParams(paymentRequirements, paymentPayload);
    
    // Validate configuration
    const networkConfig = getNetworkConfig(paymentRequirements.network);
    validateSettlementRouter(
      paymentRequirements.network,
      params.settlementRouter,
      config.allowedRouters,
      networkConfig,
    );

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
      publicClient,
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
