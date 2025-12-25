/**
 * Validation utilities for @x402x/facilitator_v2
 *
 * Provides parameter validation and security checks for SettlementRouter integration
 */

import type { SettlementExtraCore, NetworkConfig, Address, Network } from "@x402x/core_v2";
import { FacilitatorValidationError } from "@x402x/core_v2";

/**
 * Check if an Ethereum address is valid
 */
export function isValidEthereumAddress(address: string): address is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Check if a hex string is valid
 */
export function isValidHex(hex: string): boolean {
  return /^0x[a-fA-F0-9]*$/.test(hex) && hex.length % 2 === 0 && hex.length >= 2;
}

/**
 * Check if a string is a valid 32-byte hex (for salt, nonce, etc.)
 */
export function isValid32ByteHex(hex: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hex);
}

/**
 * Check if a string is a valid 256-bit number (for values, fees, timestamps)
 */
export function isValid256BitHex(hex: string): boolean {
  return /^0x[a-fA-F0-9]{1,64}$/.test(hex);
}

/**
 * Validate SettlementRouter address against allowed list
 */
export function validateSettlementRouter(
  network: string,
  router: Address,
  allowedRouters?: Record<string, string[]>,
  networkConfig?: NetworkConfig,
): Address {
  // Check if address is valid
  if (!isValidEthereumAddress(router)) {
    throw new FacilitatorValidationError(`Invalid SettlementRouter address: ${router}`);
  }

  // Check against allowed routers if provided
  if (allowedRouters && network in allowedRouters) {
    const networkAllowedRouters = allowedRouters[network];
    if (networkAllowedRouters.length > 0 && !networkAllowedRouters.includes(router)) {
      throw new FacilitatorValidationError(
        `SettlementRouter ${router} not allowed for network ${network}. ` +
          `Allowed routers: ${networkAllowedRouters.join(", ")}`,
      );
    }
  }

  // Check against network config if available
  if (networkConfig?.settlementRouter && router !== networkConfig.settlementRouter) {
    throw new FacilitatorValidationError(
      `SettlementRouter ${router} does not match network config expected router ${networkConfig.settlementRouter}`,
    );
  }

  return router;
}

/**
 * Validate settlement extra parameters
 */
export function validateSettlementExtra(extra: unknown): SettlementExtraCore {
  if (!extra || typeof extra !== "object") {
    throw new FacilitatorValidationError("Missing or invalid extra field");
  }

  const e = extra as Record<string, any>;

  // Validate required fields with type checking
  if (!e.settlementRouter || typeof e.settlementRouter !== "string") {
    throw new FacilitatorValidationError("Missing or invalid settlementRouter");
  }
  if (!isValidEthereumAddress(e.settlementRouter)) {
    throw new FacilitatorValidationError("Invalid settlementRouter address format");
  }

  if (!e.salt || typeof e.salt !== "string") {
    throw new FacilitatorValidationError("Missing or invalid salt");
  }
  if (!isValid32ByteHex(e.salt)) {
    throw new FacilitatorValidationError("Salt must be a 32-byte hex string");
  }

  if (!e.payTo || typeof e.payTo !== "string") {
    throw new FacilitatorValidationError("Missing or invalid payTo");
  }
  if (!isValidEthereumAddress(e.payTo)) {
    throw new FacilitatorValidationError("Invalid payTo address format");
  }

  if (!e.facilitatorFee || typeof e.facilitatorFee !== "string") {
    throw new FacilitatorValidationError("Missing or invalid facilitatorFee");
  }
  if (!isValid256BitHex(e.facilitatorFee)) {
    throw new FacilitatorValidationError("Facilitator fee must be a valid hex number");
  }

  if (!e.hook || typeof e.hook !== "string") {
    throw new FacilitatorValidationError("Missing or invalid hook");
  }
  if (!isValidEthereumAddress(e.hook)) {
    throw new FacilitatorValidationError("Invalid hook address format");
  }

  if (!e.hookData || typeof e.hookData !== "string") {
    throw new FacilitatorValidationError("Missing or invalid hookData");
  }
  if (!isValidHex(e.hookData)) {
    throw new FacilitatorValidationError("Hook data must be valid hex");
  }

  return {
    settlementRouter: e.settlementRouter,
    salt: e.salt,
    payTo: e.payTo,
    facilitatorFee: e.facilitatorFee,
    hook: e.hook,
    hookData: e.hookData,
  };
}

/**
 * Validate network string format
 */
export function validateNetwork(network: string): Network {
  if (!network || typeof network !== "string") {
    throw new FacilitatorValidationError("Invalid network: must be a non-empty string");
  }

  // Allow common network formats (eip155:84532, base-sepolia, etc.)
  if (!/^(eip155:\d+|[a-z][a-z0-9-]*[a-z0-9])$/.test(network)) {
    throw new FacilitatorValidationError(`Invalid network format: ${network}`);
  }

  return network as Network;
}

/**
 * Validate facilitator configuration
 */
export function validateFacilitatorConfig(config: {
  signer?: string;
  privateKey?: string;
  allowedRouters?: Record<string, string[]>;
  rpcUrls?: Record<string, string>;
}): void {
  // Debug: log what we received
  // Either signer or privateKey must be provided
  if (!config.signer && !config.privateKey) {
    throw new FacilitatorValidationError(
      "Missing signer or privateKey in facilitator configuration",
    );
  }

  // Validate signer if provided
  if (config.signer) {
    if (!isValidEthereumAddress(config.signer)) {
      throw new FacilitatorValidationError(`Invalid signer address: ${config.signer}`);
    }
  }

  // Validate private key if provided
  if (config.privateKey) {
    // Private key should be a 32-byte hex string (64 hex chars), with optional 0x prefix
    const privateKey = config.privateKey;
    const hasPrefix = privateKey.startsWith("0x") || privateKey.startsWith("0X");
    const hexBody = hasPrefix ? privateKey.slice(2) : privateKey;

    // Validate that it's a valid 64-character hex string (32 bytes)
    if (!/^[a-fA-F0-9]{64}$/.test(hexBody)) {
      throw new FacilitatorValidationError(
        "Invalid private key format: must be 32-byte hex string (64 hex chars, with optional 0x prefix)",
      );
    }
  }

  if (config.allowedRouters) {
    for (const [network, routers] of Object.entries(config.allowedRouters)) {
      validateNetwork(network);

      if (!Array.isArray(routers)) {
        throw new FacilitatorValidationError(`Allowed routers for ${network} must be an array`);
      }

      for (const router of routers) {
        if (!isValidEthereumAddress(router)) {
          throw new FacilitatorValidationError(`Invalid router address for ${network}: ${router}`);
        }
      }
    }
  }

  if (config.rpcUrls) {
    for (const [network, rpcUrl] of Object.entries(config.rpcUrls)) {
      validateNetwork(network);

      if (typeof rpcUrl !== "string" || !rpcUrl.startsWith("http")) {
        throw new FacilitatorValidationError(`Invalid RPC URL for ${network}: ${rpcUrl}`);
      }
    }
  }
}

/**
 * Validate gas limit configuration
 */
export function validateGasLimit(gasLimit: bigint): void {
  if (gasLimit <= 0n) {
    throw new FacilitatorValidationError("Gas limit must be positive");
  }

  if (gasLimit > 10_000_000n) {
    throw new FacilitatorValidationError("Gas limit too large (> 10M)");
  }
}

/**
 * Validate gas multiplier
 */
export function validateGasMultiplier(multiplier: number): void {
  if (multiplier <= 0) {
    throw new FacilitatorValidationError("Gas multiplier must be positive");
  }

  if (multiplier > 5) {
    throw new FacilitatorValidationError("Gas multiplier too large (> 5x)");
  }
}

/**
 * Validate fee amount against minimum and maximum
 */
export function validateFeeAmount(fee: string, minFee?: string, maxFee?: string): void {
  let feeBigInt: bigint;

  try {
    feeBigInt = BigInt(fee);
  } catch (error) {
    throw new FacilitatorValidationError(`Invalid fee amount: ${fee}. Must be a valid number.`);
  }

  if (feeBigInt < 0n) {
    throw new FacilitatorValidationError("Fee cannot be negative");
  }

  if (minFee && feeBigInt < BigInt(minFee)) {
    throw new FacilitatorValidationError(`Fee below minimum: ${fee} < ${minFee}`);
  }

  if (maxFee && feeBigInt > BigInt(maxFee)) {
    throw new FacilitatorValidationError(`Fee above maximum: ${fee} > ${maxFee}`);
  }
}
