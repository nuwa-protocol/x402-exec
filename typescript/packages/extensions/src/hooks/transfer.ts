/**
 * TransferHook utilities
 *
 * TransferHook is a builtin hook that supports two modes:
 * 1. Simple Transfer: Direct transfer to a single recipient (data = '0x')
 * 2. Distributed Transfer: Split transfer to multiple recipients by percentage
 */

import type { Network } from "@x402/core/types";
import { encodeAbiParameters } from "viem";
import type { Address } from "viem";

import { getNetworkConfig } from "../networks.js";

/**
 * Split configuration for distributed transfer
 */
export interface Split {
  /** Recipient address */
  recipient: Address;
  /** Basis points (1-10000, where 10000 = 100%, 1 = 0.01%) */
  bips: number;
}

/**
 * TransferHook utilities namespace
 */
export namespace TransferHook {
  /**
   * Encode hookData for TransferHook
   *
   * Supports two modes:
   *
   * **Mode 1 - Simple Transfer** (no parameters):
   * - Transfers entire amount to the `recipient` address in ExecuteParams
   * - Most gas efficient
   * - Returns '0x'
   *
   * **Mode 2 - Distributed Transfer** (with splits):
   * - Distributes amount to multiple recipients based on percentage (bips)
   * - Each split specifies recipient address and basis points (1-10000)
   * - If total bips < 10000, remaining goes to the `recipient` in ExecuteParams
   * - If total bips = 10000, `recipient` receives nothing
   *
   * @param splits - Optional array of split configurations
   * @returns Encoded hookData as hex string
   * @throws Error if validation fails (invalid addresses, bips > 10000, etc.)
   *
   * @example Simple transfer
   * ```typescript
   * // All amount goes to recipient
   * const hookData = TransferHook.encode();
   * // => '0x'
   *
   * await client.execute({
   *   hook: TransferHook.getAddress('base-sepolia'),
   *   hookData,
   *   amount: '100',
   *   recipient: '0xAlice...'  // Alice receives 100%
   * });
   * ```
   *
   * @example Distributed transfer - full split
   * ```typescript
   * // Split between Alice (60%) and Bob (40%)
   * const hookData = TransferHook.encode([
   *   { recipient: '0xAlice...', bips: 6000 },  // 60%
   *   { recipient: '0xBob...', bips: 4000 }     // 40%
   * ]);
   *
   * await client.execute({
   *   hook: TransferHook.getAddress('base-sepolia'),
   *   hookData,
   *   amount: '100',
   *   recipient: '0xCharity...'  // Charity receives 0% (total = 100%)
   * });
   * ```
   *
   * @example Distributed transfer - partial split
   * ```typescript
   * // Platform takes 30%, creator gets the rest
   * const hookData = TransferHook.encode([
   *   { recipient: '0xPlatform...', bips: 3000 }  // 30%
   * ]);
   *
   * await client.execute({
   *   hook: TransferHook.getAddress('base-sepolia'),
   *   hookData,
   *   amount: '100',
   *   recipient: '0xCreator...'  // Creator receives 70%
   * });
   * ```
   */
  export function encode(splits?: Split[]): string {
    // Mode 1: Simple Transfer
    if (!splits || splits.length === 0) {
      return "0x";
    }

    // Mode 2: Distributed Transfer - Validate splits
    let totalBips = 0;
    for (const split of splits) {
      // Validate recipient
      if (!split.recipient || split.recipient === "0x0000000000000000000000000000000000000000") {
        throw new Error(`Invalid recipient address: ${split.recipient}`);
      }

      // Validate bips
      if (split.bips <= 0) {
        throw new Error(`Bips must be greater than 0, got: ${split.bips}`);
      }
      if (split.bips > 10000) {
        throw new Error(`Individual bips cannot exceed 10000, got: ${split.bips}`);
      }

      totalBips += split.bips;
    }

    // Validate total bips
    if (totalBips > 10000) {
      throw new Error(`Total bips (${totalBips}) exceeds 10000 (100%)`);
    }

    // Encode as tuple(address,uint16)[]
    // viem requires component definitions for tuple types
    return encodeAbiParameters(
      [
        {
          type: "tuple[]",
          name: "splits",
          components: [
            { name: "recipient", type: "address" },
            { name: "bips", type: "uint16" },
          ],
        },
      ],
      [splits.map((s) => ({ recipient: s.recipient, bips: s.bips }))],
    );
  }

  /**
   * Get TransferHook address for a specific network
   *
   * Accepts both CAIP-2 format (preferred) and human-readable network names (legacy).
   *
   * @param network - Network identifier (CAIP-2 or human-readable name)
   * @returns TransferHook contract address
   * @throws Error if network is not supported
   *
   * @example
   * ```typescript
   * // Preferred: CAIP-2 format
   * const address = TransferHook.getAddress('eip155:84532');
   * // => '0x4DE234059C6CcC94B8fE1eb1BD24804794083569'
   *
   * // Legacy: human-readable name
   * const address2 = TransferHook.getAddress('base-sepolia');
   * // => '0x4DE234059C6CcC94B8fE1eb1BD24804794083569'
   * ```
   */
  export function getAddress(network: string | Network): string {
    const config = getNetworkConfig(network);
    return config.hooks.transfer;
  }
}
