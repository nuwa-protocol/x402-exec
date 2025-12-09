/**
 * Configuration loader for x402-exec Showcase server
 * Loads and validates environment variables
 */

import { config, parse } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load env from local .env first; then fill missing keys from repo root .env
config();

// Try to locate the repository-root .env and load any missing vars from it
(() => {
  try {
    // Walk up from a starting directory until we find a .env (max ~6 levels)
    const startDirs = [
      process.cwd(),
      // Directory of this file at runtime (works in ESM + after build)
      path.dirname(fileURLToPath(import.meta.url)),
    ];

    function findEnvUpwards(startDir: string): string | undefined {
      let dir = path.resolve(startDir);
      for (let i = 0; i < 6; i++) {
        const candidate = path.join(dir, ".env");
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return undefined;
    }

    let envPath: string | undefined;
    for (const dir of startDirs) {
      envPath = findEnvUpwards(dir);
      if (envPath) break;
    }

    if (envPath && fs.existsSync(envPath)) {
      const parsed = parse(fs.readFileSync(envPath));
      // Only backfill keys that are currently undefined
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
    }
  } catch {
    // Non-fatal if root .env is missing; required keys are validated below
  }
})();


export interface Config {
  port: number;
  defaultNetwork: string;
  facilitatorUrl: string;

  // Resource server configuration
  resourceServerAddress: string;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}




export const appConfig: Config = {
  port: parseInt(process.env.PORT || "3001"),
  defaultNetwork: getRequiredEnv("DEFAULT_NETWORK"),
  facilitatorUrl: getRequiredEnv("FACILITATOR_URL"),


  // Resource server configuration
  resourceServerAddress: getRequiredEnv("RESOURCE_SERVER_ADDRESS"),
};

