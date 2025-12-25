/**
 * x402-exec Showcase Server
 * Demonstrates x402x settlement for server-controlled scenarios using official x402 v2 SDK
 *
 * Server Mode: Premium Download
 * - Server controls payment requirements and business logic
 * - Demonstrates server-side access control
 * - Uses official @x402/hono middleware with x402x extension
 *
 * Note: Most scenarios have moved to Serverless Mode (client-side only)
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/http";
import type { RouteConfig as X402RouteConfig } from "@x402/core/server";
import {
  registerRouterSettlement,
  getSupportedNetworksV2,
  TransferHook,
  createSettlementRouteConfig,
} from "@x402x/extensions";
import { appConfig } from "./config.js";
import * as premiumDownload from "./scenarios/premium-download.js";

// Extend Hono Context to include x402 data (will be set by middleware if needed)
declare module "hono" {
  interface ContextVariableMap {
    x402?: {
      payer: string;
      amount: string;
      network: string;
      payment: unknown;
      requirements: unknown;
    };
  }
}

const app = new Hono();

// ===== Configure x402 v2 Resource Server =====

// Create facilitator client
const facilitatorClient = new HTTPFacilitatorClient({
  url: appConfig.facilitatorUrl,
});

// Create and configure x402 resource server
const resourceServer = new x402ResourceServer(facilitatorClient);

// Register EVM exact scheme
registerExactEvmScheme(resourceServer, {});

// Register x402x router settlement extension
registerRouterSettlement(resourceServer);

// Initialize facilitator support (fetch supported schemes/networks)
await resourceServer.initialize();

console.log("✅ x402 Resource Server initialized");

// ===== Configure Routes with Settlement =====

// Use createSettlementRouteConfig to build route configuration following v2 standard
// Settlement params are now in extensions, not extra
const routes: Record<string, X402RouteConfig> = {
  "POST /api/purchase-download": createSettlementRouteConfig(
    {
      accepts: {
        scheme: "exact",
        network: "eip155:84532" as `${string}:${string}`, // Base Sepolia - ensure type is correct
        payTo: appConfig.resourceServerAddress, // Will be overridden to settlementRouter
        price: "$1.00",
      },
      description: "Premium Content Download: Purchase and download digital content",
      mimeType: "application/json",
    },
    {
      hook: TransferHook.getAddress("base-sepolia"),
      hookData: TransferHook.encode(),
      finalPayTo: appConfig.resourceServerAddress,
      facilitatorFee: "0", // Will be calculated by facilitator
      description: "Router settlement for premium download",
    }
  ) as X402RouteConfig, // Cast to ensure type compatibility
};

// Enable CORS for frontend
app.use(
  "/*",
  cors({
    origin: "*",
    credentials: false,
  }),
);

// Global error handler
app.onError((err, c) => {
  console.error("[Global Error Handler]", err);
  console.error("[Global Error Stack]", err.stack);
  return c.json(
    {
      error: err.message || "Internal server error",
      details: err.stack,
    },
    500,
  );
});

// ===== General Endpoints =====

app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    message: "x402-exec Showcase Server (Official SDK + x402x Extension)",
    defaultNetwork: appConfig.defaultNetwork,
    supportedNetworks: getSupportedNetworksV2(),
  });
});

app.get("/api/scenarios", (c) => {
  return c.json({
    scenarios: ["premium-download"],
    note: "Other scenarios have moved to Serverless Mode (client-side implementation)",
  });
});

// ===== Premium Content Download (Server Mode) =====

app.get("/api/premium-download/info", (c) => {
  const info = premiumDownload.getScenarioInfo();
  return c.json(info);
});

// Apply payment middleware to protected route
app.use("/api/purchase-download", paymentMiddleware(routes, resourceServer));

app.post("/api/purchase-download", async (c) => {
  // At this point, payment is verified and settled by the middleware
  // We can access payment info if the middleware sets context
  const body = await c.req.json();

  console.log("[Premium Download] Payment completed successfully");

  // Verify content exists
  const contentId = body.contentId || "x402-protocol-guide";
  const content = premiumDownload.getContentItem(contentId);

  if (!content) {
    return c.json(
      {
        success: false,
        error: `Content not found: ${contentId}`,
      },
      404,
    );
  }

  // Generate download access
  // Note: payer address would ideally come from middleware context
  // For now, we use a placeholder - in production, extract from payment context
  const downloadAccess = premiumDownload.generateDownloadUrl(
    contentId,
    "0x0000000000000000000000000000000000000000" as `0x${string}`,
  );

  console.log(`[Premium Download] Generated download URL`);
  console.log(`[Premium Download] Content: ${content.title}`);
  console.log(`[Premium Download] Expires: ${downloadAccess.expiresAt}`);

  return c.json({
    success: true,
    message: "Purchase successful",
    downloadUrl: downloadAccess.downloadUrl,
    fileName: downloadAccess.fileName,
    expiresAt: downloadAccess.expiresAt,
    network: "eip155:84532",
  });
});

// Serve download files
app.get("/api/download/:contentId", async (c) => {
  const contentId = c.req.param("contentId");
  const token = c.req.query("token");

  if (!token) {
    return c.json({ error: "Download token required" }, 401);
  }

  // Verify token
  const isValid = premiumDownload.verifyDownloadToken(contentId, token);
  if (!isValid) {
    return c.json({ error: "Invalid or expired download token" }, 403);
  }

  const content = premiumDownload.getContentItem(contentId);
  if (!content) {
    return c.json({ error: "Content not found" }, 404);
  }

  console.log(`[Download] Serving ${content.fileName} to user`);

  // In production, stream file from S3/cloud storage
  // For demo, serve the static PDF file
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");

    // Get the directory of the current file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // In production (dist/), static files are at dist/static/
    // In development (src/), static files are at ../static/
    const staticDir = __dirname.includes("/dist")
      ? join(__dirname, "static") // Production: dist/static/
      : join(__dirname, "..", "static"); // Development: server/static/

    const filePath = join(staticDir, content.fileName);

    const fileContent = await readFile(filePath);

    return c.body(fileContent, 200, {
      "Content-Type": content.mimeType,
      "Content-Disposition": `attachment; filename="${content.fileName}"`,
      "Content-Length": fileContent.length.toString(),
    });
  } catch (error) {
    console.error("[Download] Error reading file:", error);
    return c.json({ error: "File not found" }, 404);
  }
});

// Start server
const port = Number(process.env.PORT) || 3000;
console.log(`🚀 x402-exec Showcase Server (Official x402 v2 SDK + x402x Extension)`);
console.log(`📍 Default network: ${appConfig.defaultNetwork}`);
console.log(`🌐 Supported networks: ${getSupportedNetworksV2().join(", ")}`);
console.log(`💰 Resource server address: ${appConfig.resourceServerAddress}`);
console.log(`🔧 Facilitator URL: ${appConfig.facilitatorUrl}`);
console.log(`📥 Server Mode: Premium Download`);
console.log(`🎯 Starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
