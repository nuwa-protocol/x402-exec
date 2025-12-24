/**
 * RouterSettlementFacilitator implementation
 *
 * Implements SchemeNetworkFacilitator interface using SettlementRouter for atomic settlement
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
} from "@x402/core/types";
import type {
  VerifyResponse,
  SettleResponse,
  FacilitatorConfig,
  Address,
  Network,
} from "./types.js";
import { FacilitatorValidationError, SettlementRouterError } from "./types.js";
import { isSettlementMode, parseSettlementExtra, getNetworkConfig } from "@x402x/core_v2";
import { calculateCommitment } from "@x402x/core_v2";
import {
  settleWithSettlementRouter,
  createPublicClientForNetwork,
  createWalletClientForNetwork,
  waitForSettlementReceipt,
} from "./settlement.js";
import { verifyTypedData, parseErc6492Signature } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// EIP-712 authorization types for EIP-3009
const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

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
function parseEvmExactPayload(payload: PaymentPayload): ExactEvmPayload {
  // x402 v2 uses payload.payload for scheme-specific data
  const evmPayload = payload.payload as ExactEvmPayload;
  
  if (!evmPayload.signature) {
    throw new FacilitatorValidationError("Missing signature in EVM exact payload");
  }
  
  if (!evmPayload.authorization) {
    throw new FacilitatorValidationError("Missing authorization in EVM exact payload");
  }
  
  const auth = evmPayload.authorization;
  if (!auth.from || !auth.to || !auth.value || !auth.nonce) {
    throw new FacilitatorValidationError("Invalid authorization structure in EVM exact payload");
  }
  
  return evmPayload;
}

// EIP-3009 ABI for token contracts
const eip3009ABI = [
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    name: "transferWithAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
import {
  validateFacilitatorConfig,
  validateNetwork,
  validateSettlementExtra,
  validateSettlementRouter,
  validateFeeAmount,
} from "./validation.js";

/**
 * SchemeNetworkFacilitator implementation using SettlementRouter
 *
 * Provides atomic settlement with hooks and facilitator fee handling
 */
export class RouterSettlementFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = "exact";
  readonly caipFamily = "eip155:*";

  private readonly config: FacilitatorConfig;

  constructor(config: FacilitatorConfig) {
    // Validate configuration
    validateFacilitatorConfig(config);

    this.config = {
      // Default values
      gasConfig: {
        maxGasLimit: 5_000_000n,
        gasMultiplier: 1.2,
      },
      feeConfig: {
        minFee: "0x0",
        maxFee: "0xFFFFFFFFFFFFFFFF",
      },
      timeouts: {
        verify: 5000, // 5 seconds
        settle: 30000, // 30 seconds
      },
      // Override with user config
      ...config,
    };
  }

  /**
   * Get scheme-specific extra data for responses
   */
  getExtra(network: string): Record<string, unknown> | undefined {
    try {
      // Validate network format first
      if (!network || typeof network !== "string" || network.trim() === "") {
        return undefined;
      }

      const networkConfig = getNetworkConfig(network);
      if (!networkConfig) {
        return undefined;
      }

      return {
        scheme: this.scheme,
        caipFamily: this.caipFamily,
        settlementRouter: networkConfig?.settlementRouter,
        defaultAsset: networkConfig?.defaultAsset,
        supportedNetworks: [network], // Can be expanded for multi-network support
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get signer addresses for the network
   * Derives from privateKey if signer address not explicitly provided
   */
  getSigners(network: string): string[] {
    validateNetwork(network);
    // Use provided signer or derive from private key
    if (this.config.signer) {
      return [this.config.signer];
    }
    if (this.config.privateKey) {
      const account = privateKeyToAccount(this.config.privateKey as `0x${string}`);
      return [account.address];
    }
    throw new Error("Either signer or privateKey must be provided in FacilitatorConfig");
  }

  /**
   * Verify payment payload without executing settlement
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    try {
      // Basic validations
      this.validateBasicPayload(payload, requirements);

      // Check if SettlementRouter mode
      const isRouterSettlement = isSettlementMode(requirements);

      if (isRouterSettlement) {
        return await this.verifySettlementRouter(payload, requirements);
      } else {
        return await this.verifyStandard(payload, requirements);
      }
    } catch (error) {
      if (error instanceof FacilitatorValidationError || error instanceof SettlementRouterError) {
        return {
          isValid: false,
          invalidReason: error.message,
          payer: payload.payer,
        };
      }

      // Handle unexpected errors
      return {
        isValid: false,
        invalidReason: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        payer: payload.payer,
      };
    }
  }

  /**
   * Settle payment by executing blockchain transaction
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    try {
      // Pre-verify payment
      const verification = await this.verify(payload, requirements);
      if (!verification.isValid) {
        return {
          success: false,
          transaction: "",
          network: requirements.network,
          payer: payload.payer,
          errorReason: verification.invalidReason || "Payment verification failed",
        };
      }

      // Check if SettlementRouter mode
      const isRouterSettlement = isSettlementMode(requirements);

      if (isRouterSettlement) {
        return await this.settleWithRouter(payload, requirements);
      } else {
        return await this.settleStandard(payload, requirements);
      }
    } catch (error) {
      return {
        success: false,
        transaction: "",
        network: requirements.network,
        payer: payload.payer,
        errorReason: error instanceof Error ? error.message : "Unknown settlement error",
      };
    }
  }

  /**
   * Validate basic payload and requirements
   */
  private validateBasicPayload(payload: PaymentPayload, requirements: PaymentRequirements): void {
    // Validate network
    validateNetwork(requirements.network);

    // Validate scheme match
    if (requirements.scheme !== this.scheme) {
      throw new FacilitatorValidationError(
        `Scheme mismatch: expected ${this.scheme}, got ${requirements.scheme}`,
      );
    }

    // Validate CAIP family
    if (!requirements.network.startsWith("eip155:")) {
      throw new FacilitatorValidationError(
        `Unsupported network family: ${requirements.network}. Only EVM networks (eip155:*) are supported`,
      );
    }

    // Parse and validate EVM exact payload structure
    const evmPayload = parseEvmExactPayload(payload);

    if (!requirements.asset) {
      throw new FacilitatorValidationError("Missing asset in payment requirements");
    }

    if (!requirements.payTo) {
      throw new FacilitatorValidationError("Missing payTo address in payment requirements");
    }

    if (!requirements.amount) {
      throw new FacilitatorValidationError("Missing amount in payment requirements");
    }
  }

  /**
   * Verify payment for SettlementRouter mode
   */
  private async verifySettlementRouter(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    // Parse EVM exact payload
    const evmPayload = parseEvmExactPayload(payload);
    const payer = evmPayload.authorization.from;

    // Parse and validate settlement extra
    const settlementExtra = validateSettlementExtra(requirements.extra);

    // Validate SettlementRouter address
    const networkConfig = getNetworkConfig(requirements.network);
    validateSettlementRouter(
      requirements.network,
      settlementExtra.settlementRouter,
      this.config.allowedRouters,
      networkConfig,
    );

    // Validate facilitator fee against configuration
    validateFeeAmount(
      settlementExtra.facilitatorFee,
      this.config.feeConfig?.minFee,
      this.config.feeConfig?.maxFee,
    );

    // Create public client for balance checks and commitment verification
    const publicClient = createPublicClientForNetwork(requirements.network, this.config.rpcUrls);

    // Signature verification using EIP-712 typed data
    try {
      // Parse signature (handle ERC-6492 for smart wallets)
      const parsedSignature = parseErc6492Signature(evmPayload.signature as `0x${string}`);

      // Build EIP-712 typed data for verification
      const typedData = {
        types: authorizationTypes,
        primaryType: "TransferWithAuthorization",
        domain: {
          name: settlementExtra.name,
          version: settlementExtra.version,
          chainId: parseInt(requirements.network.split(":")[1]),
          verifyingContract: requirements.asset,
        },
        message: {
          from: payer,
          to: evmPayload.authorization.to,
          value: BigInt(evmPayload.authorization.value),
          validAfter: BigInt(evmPayload.authorization.validAfter || "0x0"),
          validBefore: BigInt(evmPayload.authorization.validBefore || "0xFFFFFFFFFFFFFFFF"),
          nonce: evmPayload.authorization.nonce,
        },
      };

      // Verify signature using viem
      const isValidSignature = await verifyTypedData({
        address: payer as Address,
        ...typedData,
        signature: parsedSignature.signature,
      });

      if (!isValidSignature) {
        return {
          isValid: false,
          invalidReason: "Invalid signature",
          payer,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `Signature verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        payer,
      };
    }

    // Commitment verification using @x402x/core_v2
    try {
      const chainId = parseInt(requirements.network.split(":")[1]);
      const calculatedCommitment = calculateCommitment({
        chainId,
        hub: settlementExtra.settlementRouter,
        asset: requirements.asset,
        from: payer,
        value: evmPayload.authorization.value,
        validAfter: evmPayload.authorization.validAfter || "0x0",
        validBefore: evmPayload.authorization.validBefore || "0xFFFFFFFFFFFFFFFF",
        salt: settlementExtra.salt,
        payTo: settlementExtra.payTo,
        facilitatorFee: settlementExtra.facilitatorFee,
        hook: settlementExtra.hook,
        hookData: settlementExtra.hookData,
      });

      if (evmPayload.authorization.nonce !== calculatedCommitment) {
        return {
          isValid: false,
          invalidReason: "Commitment mismatch: nonce does not match calculated commitment",
          payer,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `Commitment verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        payer,
      };
    }

    // Balance checks using viem public client
    try {
      // Check token balance
      const balance = await publicClient.readContract({
        address: requirements.asset as Address,
        abi: [
          {
            type: "function",
            name: "balanceOf",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
          },
        ],
        functionName: "balanceOf",
        args: [payer as Address],
      });

      const totalRequired =
        BigInt(requirements.amount) + BigInt(settlementExtra.facilitatorFee);
      if (balance < totalRequired) {
        return {
          isValid: false,
          invalidReason: `Insufficient balance: have ${balance}, need ${totalRequired}`,
          payer,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `Balance check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        payer,
      };
    }

    return {
      isValid: true,
      payer,
    };
  }

  /**
   * Verify payment for standard mode (fallback)
   */
  private async verifyStandard(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    // Parse EVM exact payload
    const evmPayload = parseEvmExactPayload(payload);
    const payer = evmPayload.authorization.from;

    // Create viem public client
    const publicClient = createPublicClientForNetwork(requirements.network, this.config.rpcUrls);

    try {
      // Parse signature (handle ERC-6492 if needed)
      const parsedSignature = parseErc6492Signature(evmPayload.signature as `0x${string}`);

      // Build EIP-712 typed data for verification
      const typedData = {
        types: authorizationTypes,
        primaryType: "TransferWithAuthorization",
        domain: {
          name: requirements.extra?.name || "USD Coin",
          version: requirements.extra?.version || "3",
          chainId: parseInt(requirements.network.split(":")[1]),
          verifyingContract: requirements.asset,
        },
        message: {
          from: payer,
          to: requirements.payTo,
          value: BigInt(requirements.amount),
          validAfter: BigInt(evmPayload.authorization.validAfter || "0x0"),
          validBefore: BigInt(evmPayload.authorization.validBefore || "0xFFFFFFFFFFFFFFFF"),
          nonce: evmPayload.authorization.nonce,
        },
      };

      // Verify signature
      const isValidSignature = await verifyTypedData({
        address: payer as Address,
        ...typedData,
        signature: parsedSignature.signature,
      });

      if (!isValidSignature) {
        return {
          isValid: false,
          invalidReason: "Invalid signature",
          payer,
        };
      }

      // Check balance
      const balance = await publicClient.readContract({
        address: requirements.asset as Address,
        abi: eip3009ABI,
        functionName: "balanceOf",
        args: [payer as Address],
      });

      if (BigInt(balance) < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: "Insufficient balance",
          payer,
        };
      }

      return {
        isValid: true,
        payer,
      };
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `Standard verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        payer,
      };
    }
  }

  /**
   * Settle payment using SettlementRouter
   */
  private async settleWithRouter(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    return await settleWithSettlementRouter(requirements, payload, this.config, {
      gasMultiplier: this.config.gasConfig?.gasMultiplier,
      timeoutMs: this.config.timeouts?.settle,
    });
  }

  /**
   * Settle payment using standard method (fallback)
   */
  private async settleStandard(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    // Parse EVM exact payload
    const evmPayload = parseEvmExactPayload(payload);
    const payer = evmPayload.authorization.from;

    const walletClient = createWalletClientForNetwork(
      requirements.network,
      this.config.signer,
      this.config.rpcUrls,
      undefined,
      this.config.privateKey,
    );
    const publicClient = createPublicClientForNetwork(requirements.network, this.config.rpcUrls);

    try {
      // Parse signature
      const parsedSignature = parseErc6492Signature(evmPayload.signature as `0x${string}`);

      // Execute EIP-3009 transfer
      const txHash = await walletClient.writeContract({
        address: requirements.asset as Address,
        abi: eip3009ABI,
        functionName: "transferWithAuthorization",
        args: [
          payer as Address,
          requirements.payTo as Address,
          BigInt(requirements.amount),
          BigInt(evmPayload.authorization.validAfter || "0x0"),
          BigInt(evmPayload.authorization.validBefore || "0xFFFFFFFFFFFFFFFF"),
          evmPayload.authorization.nonce as `0x${string}`,
          parsedSignature.signature,
        ],
      });

      // Wait for receipt
      const receipt = await waitForSettlementReceipt(publicClient, txHash);

      return {
        success: receipt.success,
        transaction: txHash,
        network: requirements.network,
        payer,
        errorReason: receipt.success ? undefined : "Transaction failed",
      };
    } catch (error) {
      return {
        success: false,
        transaction: "",
        network: requirements.network,
        payer,
        errorReason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

/**
 * Factory function to create RouterSettlementFacilitator instance
 */
export function createRouterSettlementFacilitator(
  config: FacilitatorConfig,
): RouterSettlementFacilitator {
  return new RouterSettlementFacilitator(config);
}
