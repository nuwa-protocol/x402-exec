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
import { logRateLimitConfig } from "./middleware/rate-limit.js";

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
if (config.cache.enabled) {
  const memoryCache = createMemoryCache({
    stdTTL: config.cache.ttlTokenVersion,
    maxKeys: config.cache.maxKeys,
  });

  tokenCache = createTokenCache(memoryCache, {
    versionTTL: config.cache.ttlTokenVersion,
    metadataTTL: config.cache.ttlTokenMetadata,
  });

  logger.info(
    {
      enabled: true,
      versionTTL: config.cache.ttlTokenVersion,
      metadataTTL: config.cache.ttlTokenMetadata,
      maxKeys: config.cache.maxKeys,
    },
    "Token cache initialized",
  );
} else {
  logger.info("Token cache disabled");
}

/**
 * Initialize and start the facilitator application
 */
async function main() {
  try {
    // Log rate limiting configuration
    logRateLimitConfig(config.rateLimit);

    // Initialize account pools
    const poolManager = await createPoolManager(
      config.evmPrivateKeys,
      config.svmPrivateKeys,
      config.network,
      config.accountPool,
    );

    // Create Express app with all routes
    const app = createApp({
      shutdownManager,
      routesDeps: {
        shutdownManager,
        poolManager,
        evmAccountPools: poolManager.getEvmAccountPools(),
        svmAccountPools: poolManager.getSvmAccountPools(),
        evmAccountCount: poolManager.getEvmAccountCount(),
        svmAccountCount: poolManager.getSvmAccountCount(),
        tokenCache,
        allowedSettlementRouters: config.allowedSettlementRouters,
        x402Config: config.x402Config,
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
            multi_account:
              poolManager.getEvmAccountCount() > 1 || poolManager.getSvmAccountCount() > 1,
            account_count: {
              evm: poolManager.getEvmAccountCount(),
              svm: poolManager.getSvmAccountCount(),
            },
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
      logger.info(
        `  - Multi-account mode: ${poolManager.getEvmAccountCount() > 1 || poolManager.getSvmAccountCount() > 1 ? "✓" : "✗"}`,
      );
      logger.info(
        `  - Account count: EVM=${poolManager.getEvmAccountCount()}, SVM=${poolManager.getSvmAccountCount()}`,
      );
      logger.info(`  - Token cache: ${config.cache.enabled ? "✓" : "✗"}`);
      logger.info(`  - Rate limiting: ${config.rateLimit.enabled ? "✓" : "✗"}`);
      logger.info(`  - Request body limit: ${config.server.requestBodyLimit}`);
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
