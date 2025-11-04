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

config();

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
  console.error("Missing required environment variables: EVM_PRIVATE_KEY or SVM_PRIVATE_KEY");
  process.exit(1);
}

// Create X402 config with custom RPC URL if provided
const x402Config: X402Config | undefined = SVM_RPC_URL
  ? { svmConfig: { rpcUrl: SVM_RPC_URL } }
  : undefined;

const app = express();

// Configure express to parse JSON bodies
app.use(express.json());

type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

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
    const valid = await verify(client, paymentPayload, paymentRequirements, x402Config);
    res.json(valid);
  } catch (error) {
    console.error("error", error);
    res.status(400).json({ error: "Invalid request" });
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

    // Check if this is a Settlement Router payment
    if (isSettlementMode(paymentRequirements)) {
      console.log("Settlement Router mode detected");

      // Ensure this is an EVM network (Settlement Router is EVM-only)
      if (!SupportedEVMNetworks.includes(paymentRequirements.network)) {
        throw new Error("Settlement Router mode is only supported on EVM networks");
      }

      // Settle using SettlementRouter with whitelist validation
      const response = await settleWithRouter(
        signer,
        paymentPayload,
        paymentRequirements,
        ALLOWED_SETTLEMENT_ROUTERS,
      );
      res.json(response);
    } else {
      console.log("Standard settlement mode");

      // Settle using standard x402 flow
      const response = await settle(signer, paymentPayload, paymentRequirements, x402Config);
      res.json(response);
    }
  } catch (error) {
    console.error("error", error);
    res.status(400).json({ error: `Invalid request: ${error}` });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`x402-exec Facilitator listening at http://localhost:${PORT}`);
  console.log(`  - Standard x402 settlement: ✓`);
  console.log(`  - SettlementRouter support: ✓`);
  console.log(`  - Security whitelist: ✓`);
  console.log(``);
  console.log(`SettlementRouter Whitelist:`);
  Object.entries(ALLOWED_SETTLEMENT_ROUTERS).forEach(([network, routers]) => {
    if (routers.length > 0) {
      console.log(`  ${network}: ${routers.join(", ")}`);
    } else {
      console.log(`  ${network}: (not configured)`);
    }
  });
  console.log(``);
  console.log(`Endpoints:`);
  console.log(`  GET  /supported - List supported payment kinds`);
  console.log(`  POST /verify    - Verify payment payload`);
  console.log(`  POST /settle    - Settle payment (auto-detects mode)`);
});
