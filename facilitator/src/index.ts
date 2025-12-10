/**
 * x402-exec Facilitator Application Entry Point
 *
 * This is the main entry point for the facilitator application.
 * It initializes all dependencies and starts the HTTP server.
 */

import { loadConfig } from "./config.js";
import { createPoolManager } from "./pool-manager.js";
import { initTelemetry, getLogger } from "./telemetry.js";
import { initShutdown } from "./shutdown.js";
import { createMemoryCache, createTokenCache, type TokenCache } from "./cache/index.js";
import { createApp } from "./app.js";
import { startGasPriceUpdater } from "./dynamic-gas-price.js";
import { startTokenPriceUpdater } from "./token-price.js";
import { createBalanceChecker, type BalanceChecker } from "./balance-check.js";

// Initialize telemetry first
initTelemetry();
const logger = getLogger();

// Load configuration
const config = loadConfig();

// Initialize graceful shutdown
const shutdownManager = initShutdown({
  timeoutMs: config.server.shutdownTimeoutMs,
});

// Initialize cache
let tokenCache: TokenCache | undefined = undefined;
let balanceChecker: BalanceChecker | undefined = undefined;

if (config.cache.enabled) {
  const memoryCache = createMemoryCache({
    stdTTL: config.cache.ttlTokenVersion,
    maxKeys: config.cache.maxKeys,
  });

  tokenCache = createTokenCache(memoryCache, {
    versionTTL: config.cache.ttlTokenVersion,
    metadataTTL: config.cache.ttlTokenMetadata,
  });

  // Create dedicated cache instance for balance checks to avoid cache conflicts
  const balanceCache = createMemoryCache({
    stdTTL: 30, // 30 seconds TTL for balance checks
    maxKeys: config.cache.maxKeys,
  });

  balanceChecker = createBalanceChecker(balanceCache, {
    cacheTTL: 30, // 30 seconds TTL for balance checks
    maxCacheKeys: config.cache.maxKeys,
  });

  logger.info(
    {
      enabled: true,
      versionTTL: config.cache.ttlTokenVersion,
      metadataTTL: config.cache.ttlTokenMetadata,
      balanceCacheTTL: 30,
      maxKeys: config.cache.maxKeys,
    },
    "Token cache and balance checker initialized",
  );
} else {
  logger.info("Token cache and balance checker disabled");
}

/**
 * Initialize and start the facilitator application
 */
async function main() {
  try {
    // Log rate limiting configuration
    logger.info(
      {
        enabled: config.rateLimit.enabled,
        verifyMax: config.rateLimit.verifyMax,
        settleMax: config.rateLimit.settleMax,
        windowMs: config.rateLimit.windowMs,
      },
      "Rate limiting configuration",
    );

    // Log gas price strategy
    logger.info(
      {
        strategy: config.dynamicGasPrice.strategy,
        cacheTTL: config.dynamicGasPrice.cacheTTL,
        updateInterval: config.dynamicGasPrice.updateInterval,
        rpcConfigured: Object.keys(config.dynamicGasPrice.rpcUrls).length,
      },
      "Gas price strategy configuration",
    );

    // Log token price configuration
    logger.info(
      {
        enabled: config.tokenPrice.enabled,
        cacheTTL: config.tokenPrice.cacheTTL,
        updateInterval: config.tokenPrice.updateInterval,
        hasApiKey: !!config.tokenPrice.apiKey,
      },
      "Token price configuration",
    );

    // Start gas price updater if not static strategy
    let stopGasPriceUpdater: (() => void) | undefined;
    if (config.dynamicGasPrice.strategy !== "static") {
      logger.info(
        {
          strategy: config.dynamicGasPrice.strategy,
          networks: config.network.evmNetworks,
        },
        "Starting background gas price updater",
      );

      stopGasPriceUpdater = startGasPriceUpdater(
        config.network.evmNetworks,
        config.gasCost,
        config.dynamicGasPrice,
      );

      // Register cleanup on shutdown
      shutdownManager.addCleanupHandler(async () => {
        if (stopGasPriceUpdater) {
          stopGasPriceUpdater();
        }
      });
    } else {
      logger.info("Using static gas price configuration (no background updater)");
    }

    // Start token price updater if enabled
    let stopTokenPriceUpdater: (() => void) | undefined;
    if (config.tokenPrice.enabled) {
      logger.info(
        {
          networks: config.network.evmNetworks,
          updateInterval: config.tokenPrice.updateInterval,
        },
        "Starting background token price updater",
      );

      stopTokenPriceUpdater = startTokenPriceUpdater(
        config.network.evmNetworks,
        config.gasCost.nativeTokenPrice,
        config.tokenPrice,
      );

      // Register cleanup on shutdown
      shutdownManager.addCleanupHandler(async () => {
        if (stopTokenPriceUpdater) {
          stopTokenPriceUpdater();
        }
      });
    } else {
      logger.info("Using static token prices (no background updater)");
    }

    // Initialize account pools with custom RPC URLs
    const poolManager = await createPoolManager(
      config.evmPrivateKeys,
      config.network,
      config.accountPool,
      config.dynamicGasPrice.rpcUrls, // Pass RPC URLs from dynamicGasPrice config
    );

    // Create Express app with all routes
    const app = createApp({
      shutdownManager,
      routesDeps: {
        shutdownManager,
        poolManager,
        evmAccountPools: poolManager.getEvmAccountPools(),
        evmAccountCount: poolManager.getEvmAccountCount(),
        tokenCache,
        balanceChecker,
        allowedSettlementRouters: config.allowedSettlementRouters,
        x402Config: config.x402Config,
        gasCost: config.gasCost,
        dynamicGasPrice: config.dynamicGasPrice,
        tokenPrice: config.tokenPrice,
        feeClaim: config.feeClaim,
        gasEstimation: config.gasEstimation,
      },
      requestBodyLimit: config.server.requestBodyLimit,
      rateLimitConfig: config.rateLimit,
    });

    // Start server
    const server = app.listen(config.server.port, () => {
      logger.info(
        {
          port: config.server.port,
          features: {
            multi_account: poolManager.getEvmAccountCount() > 1,
            account_count: poolManager.getEvmAccountCount(),
            cache_enabled: config.cache.enabled,
            rate_limiting: config.rateLimit.enabled,
            request_body_limit: config.server.requestBodyLimit,
            standard_settlement: true,
            settlement_router: true,
            security_whitelist: true,
            graceful_shutdown: true,
          },
          whitelist: config.allowedSettlementRouters,
        },
        `x402-exec Facilitator listening at http://localhost:${config.server.port}`,
      );

      logger.info("Features:");
      logger.info(`  - Multi-account mode: ${poolManager.getEvmAccountCount() > 1 ? "✓" : "✗"}`);
      logger.info(`  - Account count: ${poolManager.getEvmAccountCount()}`);
      logger.info(`  - Token cache: ${config.cache.enabled ? "✓" : "✗"}`);
      logger.info(`  - Rate limiting: ${config.rateLimit.enabled ? "✓" : "✗"}`);
      logger.info(`  - Request body limit: ${config.server.requestBodyLimit}`);
      logger.info(`  - Gas price strategy: ${config.dynamicGasPrice.strategy}`);
      logger.info("  - Standard x402 settlement: ✓");
      logger.info("  - SettlementRouter support: ✓");
      logger.info("  - Security whitelist: ✓");
      logger.info("  - Graceful shutdown: ✓");
      logger.info("");
      logger.info("SettlementRouter Whitelist:");
      Object.entries(config.allowedSettlementRouters).forEach(([network, routers]) => {
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
  } catch (error) {
    logger.fatal({ error }, "Failed to initialize application");
    process.exit(1);
  }
}

// Start the application
main();
