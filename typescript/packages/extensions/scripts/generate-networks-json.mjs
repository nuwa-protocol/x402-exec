#!/usr/bin/env node
/**
 * Generate networks.json for shell deployment scripts
 *
 * This wrapper script uses dynamic import to load TypeScript modules.
 */

import { generateShellConfigs } from "./generate-networks-json.ts";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const args = process.argv.slice(2);
  const outputPath = args[0] || path.join(__dirname, "../../../contracts/networks.json");

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

try {
  main();
} catch (error) {
  console.error("Error generating networks.json:", error);
  process.exit(1);
}
