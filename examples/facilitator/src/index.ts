/* eslint-env node */
import { config } from "dotenv";

import express, { Request, Response } from "express";
import { verify, settle } from "x402/facilitator";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  createConnectedClient,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
  Signer,
  ConnectedClient,
  SupportedPaymentKind,
  isSvmSignerWallet,
  type X402Config,
} from "x402/types";
import { isSettlementMode, settleWithRouter } from "./settlement.js";
import { initTelemetry, getLogger, traced, recordMetric, recordHistogram } from "./telemetry.js";
import { initShutdown, shutdownMiddleware } from "./shutdown.js";
import { AccountPool, loadEvmPrivateKeys, loadSvmPrivateKeys } from "./account-pool.js";
import { createMemoryCache, createTokenCache, type TokenCache } from "./cache/index.js";

// Load env vars first
config();

// Initialize telemetry
initTelemetry();
const logger = getLogger();

// Initialize graceful shutdown
const shutdownManager = initShutdown({
  timeoutMs: 30000, // 30 seconds
});

// Cache configuration
const CACHE_ENABLED = process.env.CACHE_ENABLED !== "false";
const CACHE_TTL_TOKEN_VERSION = parseInt(process.env.CACHE_TTL_TOKEN_VERSION || "3600");
const CACHE_TTL_TOKEN_METADATA = parseInt(process.env.CACHE_TTL_TOKEN_METADATA || "3600");
const CACHE_MAX_KEYS = parseInt(process.env.CACHE_MAX_KEYS || "1000");

// Account pool configuration
const ACCOUNT_SELECTION_STRATEGY = (process.env.ACCOUNT_SELECTION_STRATEGY || "round_robin") as
  | "round_robin"
  | "random";

// Gas monitoring configuration (for future use)
// const MINIMUM_GAS_BALANCE = parseFloat(process.env.MINIMUM_GAS_BALANCE || "0.1");

// Load private keys
const EVM_PRIVATE_KEYS = loadEvmPrivateKeys();
const SVM_PRIVATE_KEYS = loadSvmPrivateKeys();
const SVM_RPC_URL = process.env.SVM_RPC_URL || "";

// SettlementRouter whitelist configuration for security
const ALLOWED_SETTLEMENT_ROUTERS: Record<string, string[]> = {
  "base-sepolia": [
    process.env.BASE_SEPOLIA_SETTLEMENT_ROUTER_ADDRESS ||
      "0x32431D4511e061F1133520461B07eC42afF157D6",
  ],
  base: [process.env.BASE_SETTLEMENT_ROUTER_ADDRESS || ""].filter(Boolean),
  "x-layer-testnet": [
    process.env.X_LAYER_TESTNET_SETTLEMENT_ROUTER_ADDRESS ||
      "0x1ae0e196dc18355af3a19985faf67354213f833d",
  ],
  "x-layer": [process.env.X_LAYER_SETTLEMENT_ROUTER_ADDRESS || ""].filter(Boolean),
};

// Create X402 config with custom RPC URL if provided
const x402Config: X402Config | undefined = SVM_RPC_URL
  ? { svmConfig: { rpcUrl: SVM_RPC_URL } }
  : undefined;

// Initialize cache
let tokenCache: TokenCache | undefined;
if (CACHE_ENABLED) {
  const memoryCache = createMemoryCache({
    stdTTL: CACHE_TTL_TOKEN_VERSION,
    maxKeys: CACHE_MAX_KEYS,
  });

  tokenCache = createTokenCache(memoryCache, {
    versionTTL: CACHE_TTL_TOKEN_VERSION,
    metadataTTL: CACHE_TTL_TOKEN_METADATA,
  });

  logger.info(
    {
      enabled: true,
      versionTTL: CACHE_TTL_TOKEN_VERSION,
      metadataTTL: CACHE_TTL_TOKEN_METADATA,
      maxKeys: CACHE_MAX_KEYS,
    },
    "Token cache initialized",
  );
} else {
  logger.info("Token cache disabled");
}

// Initialize account pools (one per network)
const evmAccountPools: Map<string, AccountPool> = new Map();
const svmAccountPools: Map<string, AccountPool> = new Map();

/**
 * Initialize account pools for EVM and SVM networks
 */
async function initializeAccountPools(): Promise<void> {
  if (EVM_PRIVATE_KEYS.length > 0) {
    const evmNetworks = ["base-sepolia", "base", "x-layer-testnet", "x-layer"];
    for (const network of evmNetworks) {
      try {
        const pool = await AccountPool.create(EVM_PRIVATE_KEYS, network, {
          strategy: ACCOUNT_SELECTION_STRATEGY,
        });
        evmAccountPools.set(network, pool);
        logger.info({ network, accounts: pool.getAccountCount() }, "EVM account pool created");
      } catch (error) {
        logger.warn({ network, error }, "Failed to create EVM account pool for network");
      }
    }
  }

  if (SVM_PRIVATE_KEYS.length > 0) {
    const svmNetworks = ["solana-devnet", "solana-mainnet"];
    for (const network of svmNetworks) {
      try {
        const pool = await AccountPool.create(SVM_PRIVATE_KEYS, network, {
          strategy: ACCOUNT_SELECTION_STRATEGY,
        });
        svmAccountPools.set(network, pool);
        logger.info({ network, accounts: pool.getAccountCount() }, "SVM account pool created");
      } catch (error) {
        logger.warn({ network, error }, "Failed to create SVM account pool for network");
      }
    }
  }

  // Log account pool summary
  logger.info(
    {
      evmAccounts: EVM_PRIVATE_KEYS.length,
      svmAccounts: SVM_PRIVATE_KEYS.length,
      evmNetworks: Array.from(evmAccountPools.keys()),
      svmNetworks: Array.from(svmAccountPools.keys()),
      strategy: ACCOUNT_SELECTION_STRATEGY,
    },
    "Account pools initialized",
  );
}

const app = express();

// Configure express to parse JSON bodies
app.use(express.json());

// Add shutdown middleware to reject new requests during shutdown
app.use(shutdownMiddleware);

type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

/**
 * GET /health - Health check (liveness probe)
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /ready - Readiness check with account pool health checks
 */
app.get("/ready", async (req: Request, res: Response) => {
  const checks: Record<
    string,
    | { status: string; message?: string }
    | { evm: number; svm: number; status: string }
    | {
        evm: Array<{
          network: string;
          accounts: Array<{ address: string; queueDepth: number; totalProcessed: number }>;
        }>;
        svm: Array<{
          network: string;
          accounts: Array<{ address: string; queueDepth: number; totalProcessed: number }>;
        }>;
        status: string;
      }
    | {
        enabled: boolean;
        hits?: number;
        misses?: number;
        keys?: number;
        hitRate?: string;
        status: string;
      }
  > = {};
  let allHealthy = true;

  // Check private keys are loaded
  checks.accounts = {
    evm: EVM_PRIVATE_KEYS.length,
    svm: SVM_PRIVATE_KEYS.length,
    status: EVM_PRIVATE_KEYS.length > 0 || SVM_PRIVATE_KEYS.length > 0 ? "ok" : "error",
  };

  if (checks.accounts.status === "error") {
    allHealthy = false;
  }

  // Check account pools
  const evmAccountsInfo: Array<{
    network: string;
    accounts: Array<{ address: string; queueDepth: number; totalProcessed: number }>;
  }> = [];
  for (const [network, pool] of evmAccountPools.entries()) {
    const accounts = pool.getAccountsInfo();
    evmAccountsInfo.push({
      network,
      accounts: accounts.map((acc) => ({
        address: acc.address,
        queueDepth: acc.queueDepth,
        totalProcessed: acc.totalProcessed,
      })),
    });
  }

  const svmAccountsInfo: Array<{
    network: string;
    accounts: Array<{ address: string; queueDepth: number; totalProcessed: number }>;
  }> = [];
  for (const [network, pool] of svmAccountPools.entries()) {
    const accounts = pool.getAccountsInfo();
    svmAccountsInfo.push({
      network,
      accounts: accounts.map((acc) => ({
        address: acc.address,
        queueDepth: acc.queueDepth,
        totalProcessed: acc.totalProcessed,
      })),
    });
  }

  checks.accountPools = {
    evm: evmAccountsInfo,
    svm: svmAccountsInfo,
    status: "ok",
  };

  // Check cache
  if (tokenCache) {
    const cacheStats = tokenCache.getStats();
    checks.cache = {
      enabled: true,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      keys: cacheStats.keys,
      hitRate:
        cacheStats.hits + cacheStats.misses > 0
          ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(2) + "%"
          : "0%",
      status: "ok",
    };
  } else {
    checks.cache = {
      enabled: false,
      status: "ok",
    };
  }

  // Check settlement router whitelist configured
  const hasRouters = Object.values(ALLOWED_SETTLEMENT_ROUTERS).some(
    (routers) => routers.length > 0,
  );
  checks.settlementRouterWhitelist = hasRouters
    ? { status: "ok" }
    : { status: "warning", message: "No settlement routers configured" };

  // Check if shutdown is in progress
  checks.shutdown = shutdownManager.isShutdown()
    ? { status: "error", message: "Shutdown in progress" }
    : { status: "ok" };

  if (checks.shutdown.status === "error") {
    allHealthy = false;
  }

  // Check active requests
  const activeRequests = shutdownManager.getActiveRequestCount();
  checks.activeRequests = {
    status: "ok",
    message: `${activeRequests} active request(s)`,
  };

  const status = allHealthy ? 200 : 503;

  res.status(status).json({
    status: allHealthy ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /verify - Returns info about the verify endpoint
 */
app.get("/verify", (req: Request, res: Response) => {
  res.json({
    endpoint: "/verify",
    description: "POST to verify x402 payments",
    body: {
      paymentPayload: "PaymentPayload",
      paymentRequirements: "PaymentRequirements",
    },
  });
});

/**
 * POST /verify - Verify x402 payment payload
 */
app.post("/verify", async (req: Request, res: Response) => {
  try {
    const body: VerifyRequest = req.body;
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

    // use the correct client/signer based on the requested network
    // svm verify requires a Signer because it signs & simulates the txn
    let client: Signer | ConnectedClient;
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      client = createConnectedClient(paymentRequirements.network);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      // Use account pool for SVM if available
      const pool = svmAccountPools.get(paymentRequirements.network);
      if (pool) {
        // Get a signer from the pool (will use round-robin/random selection)
        // For verify, we don't need serial execution, so we can just get the first signer
        const accountsInfo = pool.getAccountsInfo();
        if (accountsInfo.length > 0) {
          // Create a temporary signer for verification
          client = await pool.execute(async (signer) => signer);
        } else {
          throw new Error("No SVM accounts available");
        }
      } else {
        throw new Error(`No account pool for network: ${paymentRequirements.network}`);
      }
    } else {
      throw new Error("Invalid network");
    }

    // verify
    const startTime = Date.now();
    logger.info(
      {
        network: paymentRequirements.network,
        extra: paymentRequirements.extra,
      },
      "Verifying payment...",
    );

    // Wrap getVersion with cache if enabled
    const originalVerify = verify;
    const valid = await originalVerify(client, paymentPayload, paymentRequirements, x402Config);
    const duration = Date.now() - startTime;

    // Record metrics
    recordMetric("facilitator.verify.total", 1, {
      network: paymentRequirements.network,
      is_valid: String(valid.isValid),
    });
    recordHistogram("facilitator.verify.duration_ms", duration, {
      network: paymentRequirements.network,
    });

    logger.info(
      {
        isValid: valid.isValid,
        payer: valid.payer,
        invalidReason: valid.invalidReason,
        duration_ms: duration,
      },
      "Verification result",
    );

    if (!valid.isValid) {
      logger.warn(
        {
          invalidReason: valid.invalidReason,
          payer: valid.payer,
        },
        "Verification failed",
      );
    }

    res.json(valid);
  } catch (error) {
    logger.error({ error }, "Verify error");
    recordMetric("facilitator.verify.errors", 1, {
      error_type: error instanceof Error ? error.name : "unknown",
    });
    res.status(400).json({
      error: "Invalid request",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /settle - Returns info about the settle endpoint
 */
app.get("/settle", (req: Request, res: Response) => {
  res.json({
    endpoint: "/settle",
    description: "POST to settle x402 payments",
    supportedModes: ["standard", "settlementRouter"],
    body: {
      paymentPayload: "PaymentPayload",
      paymentRequirements: "PaymentRequirements (with optional extra.settlementRouter)",
    },
  });
});

/**
 * GET /supported - Returns supported payment kinds
 */
app.get("/supported", async (req: Request, res: Response) => {
  const kinds: SupportedPaymentKind[] = [];

  // evm
  if (EVM_PRIVATE_KEYS.length > 0) {
    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
    });

    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "x-layer",
    });

    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "x-layer-testnet",
    });
  }

  // svm
  if (SVM_PRIVATE_KEYS.length > 0) {
    const pool = svmAccountPools.get("solana-devnet");
    if (pool) {
      const feePayer = await pool.execute(async (signer) => {
        return isSvmSignerWallet(signer) ? signer.address : undefined;
      });

      kinds.push({
        x402Version: 1,
        scheme: "exact",
        network: "solana-devnet",
        extra: {
          feePayer,
        },
      });
    }
  }

  res.json({
    kinds,
  });
});

/**
 * POST /settle - Settle x402 payment using account pool
 *
 * This endpoint supports two settlement modes:
 * 1. Standard mode: Direct token transfer using ERC-3009
 * 2. Settlement Router mode: Token transfer + Hook execution via SettlementRouter
 *
 * The mode is automatically detected based on the presence of extra.settlementRouter
 */
app.post("/settle", async (req: Request, res: Response) => {
  try {
    const body: SettleRequest = req.body;
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

    // Get the appropriate account pool
    let accountPool: AccountPool | undefined;
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      accountPool = evmAccountPools.get(paymentRequirements.network);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      accountPool = svmAccountPools.get(paymentRequirements.network);
    }

    if (!accountPool) {
      throw new Error(`No account pool available for network: ${paymentRequirements.network}`);
    }

    const startTime = Date.now();

    // Execute settlement in the account pool's queue
    // This ensures serial execution per account (no nonce conflicts)
    const result = await accountPool.execute(async (signer: Signer) => {
      // Check if this is a Settlement Router payment
      if (isSettlementMode(paymentRequirements)) {
        logger.info(
          {
            router: paymentRequirements.extra?.settlementRouter,
            hook: paymentRequirements.extra?.hook,
            facilitatorFee: paymentRequirements.extra?.facilitatorFee,
            salt: paymentRequirements.extra?.salt,
          },
          "Settlement Router mode detected",
        );

        // Ensure this is an EVM network (Settlement Router is EVM-only)
        if (!SupportedEVMNetworks.includes(paymentRequirements.network)) {
          throw new Error("Settlement Router mode is only supported on EVM networks");
        }

        try {
          // Settle using SettlementRouter with whitelist validation
          const response = await traced(
            "settle.settlementRouter",
            async () =>
              settleWithRouter(
                signer,
                paymentPayload,
                paymentRequirements,
                ALLOWED_SETTLEMENT_ROUTERS,
              ),
            {
              network: paymentRequirements.network,
              router: paymentRequirements.extra?.settlementRouter || "",
            },
          );

          const duration = Date.now() - startTime;

          // Record metrics
          recordMetric("facilitator.settle.total", 1, {
            network: paymentRequirements.network,
            mode: "settlementRouter",
            success: String(response.success),
          });
          recordHistogram("facilitator.settle.duration_ms", duration, {
            network: paymentRequirements.network,
            mode: "settlementRouter",
          });

          logger.info(
            {
              transaction: response.transaction,
              success: response.success,
              payer: response.payer,
              duration_ms: duration,
            },
            "SettlementRouter settlement successful",
          );

          return response;
        } catch (error) {
          const duration = Date.now() - startTime;

          logger.error({ error, duration_ms: duration }, "Settlement failed");
          recordMetric("facilitator.settle.errors", 1, {
            network: paymentRequirements.network,
            mode: "settlementRouter",
            error_type: error instanceof Error ? error.name : "unknown",
          });
          throw error;
        }
      } else {
        logger.info(
          {
            network: paymentRequirements.network,
            asset: paymentRequirements.asset,
            maxAmountRequired: paymentRequirements.maxAmountRequired,
          },
          "Standard settlement mode",
        );

        try {
          // Settle using standard x402 flow
          const response = await traced(
            "settle.standard",
            async () => settle(signer, paymentPayload, paymentRequirements, x402Config),
            {
              network: paymentRequirements.network,
            },
          );

          const duration = Date.now() - startTime;

          // Record metrics
          recordMetric("facilitator.settle.total", 1, {
            network: paymentRequirements.network,
            mode: "standard",
            success: String(response.success),
          });
          recordHistogram("facilitator.settle.duration_ms", duration, {
            network: paymentRequirements.network,
            mode: "standard",
          });

          logger.info(
            {
              transaction: response.transaction,
              success: response.success,
              payer: response.payer,
              duration_ms: duration,
            },
            "Standard settlement successful",
          );

          return response;
        } catch (error) {
          const duration = Date.now() - startTime;

          logger.error({ error, duration_ms: duration }, "Standard settlement failed");
          recordMetric("facilitator.settle.errors", 1, {
            network: paymentRequirements.network,
            mode: "standard",
            error_type: error instanceof Error ? error.name : "unknown",
          });
          throw error;
        }
      }
    });

    res.json(result);
  } catch (error) {
    logger.error({ error }, "Settle error");
    res.status(400).json({
      error: `Settlement failed: ${error instanceof Error ? error.message : String(error)}`,
      details: error instanceof Error ? error.stack : undefined,
    });
  }
});

const PORT = process.env.PORT || 3000;

// Initialize account pools and start server
initializeAccountPools()
  .then(() => {
    const server = app.listen(PORT, () => {
      logger.info(
        {
          port: PORT,
          features: {
            multi_account: EVM_PRIVATE_KEYS.length > 1 || SVM_PRIVATE_KEYS.length > 1,
            account_count: {
              evm: EVM_PRIVATE_KEYS.length,
              svm: SVM_PRIVATE_KEYS.length,
            },
            cache_enabled: CACHE_ENABLED,
            standard_settlement: true,
            settlement_router: true,
            security_whitelist: true,
            graceful_shutdown: true,
          },
          whitelist: ALLOWED_SETTLEMENT_ROUTERS,
        },
        `x402-exec Facilitator listening at http://localhost:${PORT}`,
      );

      logger.info("Features:");
      logger.info(
        `  - Multi-account mode: ${EVM_PRIVATE_KEYS.length > 1 || SVM_PRIVATE_KEYS.length > 1 ? "✓" : "✗"}`,
      );
      logger.info(
        `  - Account count: EVM=${EVM_PRIVATE_KEYS.length}, SVM=${SVM_PRIVATE_KEYS.length}`,
      );
      logger.info(`  - Token cache: ${CACHE_ENABLED ? "✓" : "✗"}`);
      logger.info("  - Standard x402 settlement: ✓");
      logger.info("  - SettlementRouter support: ✓");
      logger.info("  - Security whitelist: ✓");
      logger.info("  - Graceful shutdown: ✓");
      logger.info("");
      logger.info("SettlementRouter Whitelist:");
      Object.entries(ALLOWED_SETTLEMENT_ROUTERS).forEach(([network, routers]) => {
        if (routers.length > 0) {
          logger.info(`  ${network}: ${routers.join(", ")}`);
        } else {
          logger.info(`  ${network}: (not configured)`);
        }
      });
      logger.info("");
      logger.info("Endpoints:");
      logger.info("  GET  /health     - Health check (liveness probe)");
      logger.info("  GET  /ready      - Readiness check (with account pool status)");
      logger.info("  GET  /supported  - List supported payment kinds");
      logger.info("  POST /verify     - Verify payment payload");
      logger.info("  POST /settle     - Settle payment (auto-detects mode)");
    });

    // Register server for graceful shutdown
    shutdownManager.registerServer(server);
  })
  .catch((error) => {
    logger.fatal({ error }, "Failed to initialize account pools");
    process.exit(1);
  });
