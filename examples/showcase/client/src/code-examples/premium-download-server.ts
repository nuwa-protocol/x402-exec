// @ts-nocheck
// This file is for display purposes only and is not compiled
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { registerExactEvmScheme } from "@x402/evm/exact/server/register";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { registerRouterSettlement, createSettlementRouteConfig, TransferHook } from "@x402x/core_v2";

const app = new Hono();

// 1. Initialize x402 Resource Server with facilitator
const facilitatorClient = new HTTPFacilitatorClient({
  url: "http://localhost:3001",
});
const server = new x402ResourceServer(facilitatorClient);

// 2. Register schemes and extensions
registerExactEvmScheme(server, {});
registerRouterSettlement(server); // Register x402x settlement extension

await server.initialize();

// 3. Define protected route with payment requirements
const routes = {
  "POST /api/purchase-download": createSettlementRouteConfig(
    {
      accepts: {
        scheme: "exact",
        network: "eip155:84532", // Base Sepolia
        payTo: "0xMerchantAddress", // Will be overridden by settlementRouter
        price: "$1.00",
      },
      description: "Premium Content Download",
    },
    {
      hook: TransferHook.getAddress("eip155:84532"),
      hookData: TransferHook.encode(),
      finalPayTo: "0xMerchantAddress", // Actual merchant address
    }
  ),
};

// 4. Apply payment middleware to protected route
app.use("/api/purchase-download", paymentMiddleware(routes, server));

// 5. Handle successful payment
app.post("/api/purchase-download", async (c) => {
  const { contentId, walletAddress } = await c.req.json();

  // Generate secure download link (expires in 24h)
  const downloadUrl = generateSecureUrl(contentId, walletAddress);

  return c.json({
    success: true,
    downloadUrl,
    fileName: "x402-whitepaper.pdf",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
});
