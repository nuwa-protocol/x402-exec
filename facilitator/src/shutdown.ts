/**
 * Graceful Shutdown Handler
 *
 * This module provides graceful shutdown handling for the facilitator service,
 * ensuring that in-flight requests are completed before process termination.
 *
 * Based on deps/x402-rs/src/sig_down.rs implementation
 */

import { Server } from "http";
import { getLogger, shutdownTelemetry } from "./telemetry.js";

const logger = getLogger();

/**
 * Shutdown configuration
 */
export interface ShutdownConfig {
  /** Maximum time to wait for graceful shutdown in milliseconds */
  timeoutMs: number;

  /** Signals to handle */
  signals: NodeJS.Signals[];

  /** Cleanup handlers to run during shutdown */
  cleanupHandlers: Array<() => Promise<void>>;
}

/**
 * Default shutdown configuration
 */
const DEFAULT_SHUTDOWN_CONFIG: ShutdownConfig = {
  timeoutMs: 30000, // 30 seconds
  signals: ["SIGTERM", "SIGINT"],
  cleanupHandlers: [],
};

/**
 * Graceful shutdown manager
 */
export class GracefulShutdown {
  private server?: Server;
  private config: ShutdownConfig;
  private isShuttingDown = false;
  private shutdownPromise?: Promise<void>;
  private activeRequests = 0;
  private requestsCompleted = 0;

  /**
   *
   * @param config
   */
  constructor(config: Partial<ShutdownConfig> = {}) {
    this.config = { ...DEFAULT_SHUTDOWN_CONFIG, ...config };
  }

  /**
   * Register HTTP server for graceful shutdown
   *
   * @param server
   */
  public registerServer(server: Server): void {
    this.server = server;

    // Track active requests
    server.on("request", (req, res) => {
      this.activeRequests++;

      res.on("finish", () => {
        this.activeRequests--;
        this.requestsCompleted++;

        logger.debug(
          {
            activeRequests: this.activeRequests,
            requestsCompleted: this.requestsCompleted,
          },
          "Request completed",
        );
      });
    });

    logger.info("HTTP server registered for graceful shutdown");
  }

  /**
   * Add cleanup handler
   *
   * @param handler
   */
  public addCleanupHandler(handler: () => Promise<void>): void {
    this.config.cleanupHandlers.push(handler);
  }

  /**
   * Initialize signal handlers
   */
  public init(): void {
    for (const signal of this.config.signals) {
      process.on(signal, () => {
        logger.info({ signal }, "Received shutdown signal");
        this.shutdown().catch((error) => {
          logger.error({ error }, "Error during shutdown");
          process.exit(1);
        });
      });
    }

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
      logger.fatal({ error }, "Uncaught exception");
      this.shutdown().catch(() => {
        process.exit(1);
      });
    });

    process.on("unhandledRejection", (reason) => {
      logger.fatal({ reason }, "Unhandled promise rejection");
      this.shutdown().catch(() => {
        process.exit(1);
      });
    });

    logger.info(
      {
        signals: this.config.signals,
        timeout: this.config.timeoutMs,
      },
      "Graceful shutdown initialized",
    );
  }

  /**
   * Perform graceful shutdown
   */
  public async shutdown(): Promise<void> {
    // Prevent multiple shutdown calls
    if (this.isShuttingDown) {
      logger.warn("Shutdown already in progress");
      return this.shutdownPromise;
    }

    this.isShuttingDown = true;
    const shutdownStart = Date.now();

    this.shutdownPromise = (async () => {
      logger.info(
        {
          activeRequests: this.activeRequests,
          timeoutMs: this.config.timeoutMs,
        },
        "Starting graceful shutdown",
      );

      // Stop accepting new connections
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            logger.error({ error: err }, "Error closing HTTP server");
          } else {
            logger.info("HTTP server closed");
          }
        });
      }

      // Wait for active requests to complete (with timeout)
      const requestWaitStart = Date.now();
      const checkInterval = 100; // Check every 100ms

      while (this.activeRequests > 0) {
        const elapsed = Date.now() - requestWaitStart;

        if (elapsed >= this.config.timeoutMs) {
          logger.warn(
            {
              activeRequests: this.activeRequests,
              elapsed,
            },
            "Shutdown timeout reached, forcing shutdown",
          );
          break;
        }

        logger.debug(
          {
            activeRequests: this.activeRequests,
            elapsed,
          },
          "Waiting for active requests to complete",
        );

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }

      const requestWaitDuration = Date.now() - requestWaitStart;

      if (this.activeRequests === 0) {
        logger.info(
          {
            duration: requestWaitDuration,
            requestsCompleted: this.requestsCompleted,
          },
          "All requests completed",
        );
      }

      // Run cleanup handlers
      logger.info(
        {
          handlers: this.config.cleanupHandlers.length,
        },
        "Running cleanup handlers",
      );

      for (const handler of this.config.cleanupHandlers) {
        try {
          await handler();
        } catch (error) {
          logger.error({ error }, "Error in cleanup handler");
        }
      }

      // Shutdown telemetry
      try {
        await shutdownTelemetry();
      } catch (error) {
        logger.error({ error }, "Error shutting down telemetry");
      }

      const shutdownDuration = Date.now() - shutdownStart;

      logger.info(
        {
          duration: shutdownDuration,
          requestsCompleted: this.requestsCompleted,
        },
        "Graceful shutdown complete",
      );

      process.exit(0);
    })();

    return this.shutdownPromise;
  }

  /**
   * Check if shutdown is in progress
   */
  public isShutdown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get active request count
   */
  public getActiveRequestCount(): number {
    return this.activeRequests;
  }
}

/**
 * Global shutdown manager instance
 */
let shutdownManager: GracefulShutdown | null = null;

/**
 * Initialize global shutdown manager
 *
 * @param config
 */
export function initShutdown(config?: Partial<ShutdownConfig>): GracefulShutdown {
  if (shutdownManager) {
    logger.warn("Shutdown manager already initialized");
    return shutdownManager;
  }

  shutdownManager = new GracefulShutdown(config);
  shutdownManager.init();

  return shutdownManager;
}

/**
 * Get global shutdown manager
 */
export function getShutdownManager(): GracefulShutdown {
  if (!shutdownManager) {
    throw new Error("Shutdown manager not initialized. Call initShutdown() first.");
  }
  return shutdownManager;
}

/**
 * Express middleware to reject requests during shutdown
 *
 * @param req
 * @param res
 * @param next
 */
export function shutdownMiddleware(req: any, res: any, next: any): void {
  if (shutdownManager?.isShutdown()) {
    logger.warn({ url: req.url }, "Rejecting request during shutdown");
    res.status(503).json({
      error: "Service is shutting down",
      message: "Please try again later",
    });
    return;
  }
  next();
}
