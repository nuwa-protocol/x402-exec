/* eslint-env node */
import { config } from "dotenv"; // Load env vars first

import express, { Request, Response } from "express";
import { verify, settle } from "x402/facilitator";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  createConnectedClient,
  createSigner,
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
config();

// Initialize telemetry
initTelemetry();
const logger = getLogger();

// Initialize graceful shutdown
const shutdownManager = initShutdown({
  timeoutMs: 30000, // 30 seconds
});

const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || "";
const SVM_PRIVATE_KEY = process.env.SVM_PRIVATE_KEY || "";
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

if (!EVM_PRIVATE_KEY && !SVM_PRIVATE_KEY) {
  logger.error("Missing required environment variables: EVM_PRIVATE_KEY or SVM_PRIVATE_KEY");
  process.exit(1);
}

// Create X402 config with custom RPC URL if provided
const x402Config: X402Config | undefined = SVM_RPC_URL
  ? { svmConfig: { rpcUrl: SVM_RPC_URL } }
  : undefined;

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
 *
 * This endpoint is used by container orchestrators (like Kubernetes)
 * to determine if the service is alive and should continue running.
 * Returns 200 if the service is running.
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /ready - Readiness check
 *
 * This endpoint is used by container orchestrators to determine if
 * the service is ready to accept traffic. Checks that all required
 * components are initialized and operational.
 */
app.get("/ready", async (req: Request, res: Response) => {
  const checks: Record<string, { status: string; message?: string }> = {};
  let allHealthy = true;

  // Check private keys are loaded
  checks.privateKeys =
    EVM_PRIVATE_KEY || SVM_PRIVATE_KEY
      ? { status: "ok" }
      : { status: "error", message: "No private keys configured" };

  if (checks.privateKeys.status === "error") {
    allHealthy = false;
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
      client = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
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

    const valid = await verify(client, paymentPayload, paymentRequirements, x402Config);
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
  if (EVM_PRIVATE_KEY) {
    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
    });

    // Add X-Layer Mainnet support
    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "x-layer",
    });

    // Add X-Layer Testnet support
    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "x-layer-testnet",
    });
  }

  // svm
  if (SVM_PRIVATE_KEY) {
    const signer = await createSigner("solana-devnet", SVM_PRIVATE_KEY);
    const feePayer = isSvmSignerWallet(signer) ? signer.address : undefined;

    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "solana-devnet",
      extra: {
        feePayer,
      },
    });
  }
  res.json({
    kinds,
  });
});

/**
 * POST /settle - Settle x402 payment
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

    // use the correct private key based on the requested network
    let signer: Signer;
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      signer = await createSigner(paymentRequirements.network, EVM_PRIVATE_KEY);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      signer = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
    } else {
      throw new Error("Invalid network");
    }

    const startTime = Date.now();

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
            duration_ms: duration,
          },
          "Settlement successful",
        );

        res.json(response);
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
      logger.info("Standard settlement mode");

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

        logger.info({ duration_ms: duration }, "Standard settlement successful");
        res.json(response);
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
  } catch (error) {
    logger.error({ error }, "Settle error");
    res.status(400).json({
      error: `Settlement failed: ${error instanceof Error ? error.message : String(error)}`,
      details: error instanceof Error ? error.stack : undefined,
    });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      features: {
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
  logger.info("  GET  /ready      - Readiness check");
  logger.info("  GET  /supported  - List supported payment kinds");
  logger.info("  POST /verify     - Verify payment payload");
  logger.info("  POST /settle     - Settle payment (auto-detects mode)");
});

// Register server for graceful shutdown
shutdownManager.registerServer(server);
