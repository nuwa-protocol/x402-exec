#!/usr/bin/env ts-node
/**
 * Generate networks.json for shell deployment scripts
 *
 * This script aggregates network configuration from TypeScript sources
 * and exports it to a JSON format that can be easily consumed by bash scripts.
 *
 * Usage:
 *   ts-node scripts/generate-networks-json.ts [output-path]
 *
 * Output:
 *   JSON file with network configurations including CAIP-2 IDs,
 *   chain IDs, RPC URLs, explorer URLs, and environment variable prefixes.
 */

import { networks } from "../src/networks.js";
import { getChain } from "../src/chains.js";
import { NETWORK_ALIASES } from "../src/network-utils.js";
import type { Network } from "@x402/core/types";
import * as fs from "fs";
import * as path from "path";

interface ShellNetworkConfig {
  /** CAIP-2 network identifier */
  caip2: string;
  /** V1 human-readable name (for backward compatibility) */
  v1Alias: string;
  /** Environment variable prefix (e.g., BASE_SEPOLIA) */
  envPrefix: string;
  /** Chain ID */
  chainId: number;
  /** Network display name */
  name: string;
  /** Default RPC URL */
  rpcUrl: string;
  /** Block explorer base URL */
  explorerUrl: string;
  /** Gas pricing model (eip1559 or legacy) */
  gasModel: "eip1559" | "legacy";
  /** Network type (mainnet or testnet) */
  type: "mainnet" | "testnet";
  /** Native token symbol */
  nativeToken: string;
}

/**
 * Convert v1 alias to environment variable prefix
 *
 * Examples:
 *   - base-sepolia -> BASE_SEPOLIA
 *   - x-layer-testnet -> X_LAYER_TESTNET
 *   - bsc-testnet -> BSC_TESTNET
 */
function v1AliasToEnvPrefix(alias: string): string {
  return alias
    .split("-")
    .map((part) => part.toUpperCase())
    .join("_");
}

/**
 * Generate network configurations for shell scripts
 */
function generateShellConfigs(): ShellNetworkConfig[] {
  const configs: ShellNetworkConfig[] = [];

  for (const [caip2, networkConfig] of Object.entries(networks)) {
    const v1Alias = NETWORK_ALIASES[caip2 as Network];
    if (!v1Alias) {
      console.warn(`Warning: No v1 alias found for ${caip2}, skipping...`);
      continue;
    }

    try {
      const chain = getChain(caip2 as Network);
      const rpcUrl = chain.rpcUrls.default.http[0];

      configs.push({
        caip2,
        v1Alias,
        envPrefix: v1AliasToEnvPrefix(v1Alias),
        chainId: networkConfig.chainId,
        name: networkConfig.name,
        rpcUrl,
        explorerUrl: networkConfig.addressExplorerBaseUrl.replace(/\/address\/$/, ""),
        gasModel: networkConfig.metadata?.gasModel || "eip1559",
        type: networkConfig.type,
        nativeToken: networkConfig.metadata?.nativeToken || "ETH",
      });
    } catch (error) {
      console.warn(`Warning: Failed to get chain config for ${caip2}:`, error);
    }
  }

  // Sort by chain ID for consistent output
  return configs.sort((a, b) => a.chainId - b.chainId);
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const outputPath = args[0] || path.join(__dirname, "../../../../contracts/networks.json");

  console.log("Generating networks.json...");
  console.log(`Output path: ${outputPath}`);

  const configs = generateShellConfigs();

  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    version: 1,
    generated: new Date().toISOString(),
    networks: configs,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");

  console.log(`✓ Generated ${configs.length} network configurations`);
  console.log(`✓ Written to ${outputPath}`);
  console.log("\nSupported networks:");
  configs.forEach((config) => {
    console.log(
      `  - ${config.caip2} (${config.v1Alias}): ${config.name} (Chain ID: ${config.chainId})`,
    );
  });
}

// Run if executed directly
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error("Error generating networks.json:", error);
    process.exit(1);
  }
}

export { generateShellConfigs };
export type { ShellNetworkConfig };
