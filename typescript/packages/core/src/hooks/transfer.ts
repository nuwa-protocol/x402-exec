/**
 * TransferHook utilities
 *
 * TransferHook is the simplest builtin hook that performs a direct token transfer
 * with facilitator fee support. It doesn't require any parameters.
 */

import { getNetworkConfig } from "../networks.js";

/**
 * TransferHook utilities namespace
 */
export namespace TransferHook {
  /**
   * Encode hookData for TransferHook
   *
   * TransferHook doesn't require any parameters, so this always returns '0x'
   *
   * @returns Empty bytes ('0x')
   *
   * @example
   * ```typescript
   * const hookData = TransferHook.encode();
   * // => '0x'
   * ```
   */
  export function encode(): string {
    return "0x";
  }

  /**
   * Get TransferHook address for a specific network
   *
   * @param network - Network name (e.g., 'base-sepolia')
   * @returns TransferHook contract address
   * @throws Error if network is not supported
   *
   * @example
   * ```typescript
   * const address = TransferHook.getAddress('base-sepolia');
   * // => '0x4DE234059C6CcC94B8fE1eb1BD24804794083569'
   * ```
   */
  export function getAddress(network: string): string {
    const config = getNetworkConfig(network);
    return config.hooks.transfer;
  }
}
