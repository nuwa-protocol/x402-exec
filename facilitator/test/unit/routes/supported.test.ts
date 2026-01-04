/**
 * Tests for routes/supported.ts
 *
 * Tests supported payment kinds endpoint (v2-only)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  createSupportedRoutes,
  type SupportedRouteDependencies,
} from "../../../src/routes/supported.js";

describe("routes/supported (v2-only)", () => {
  let app: express.Application;
  let mockDeps: SupportedRouteDependencies;

  // Mock supported networks returned by PoolManager
  const mockSupportedNetworks = [
    { humanReadable: "base-sepolia", canonical: "eip155:84532" },
    { humanReadable: "x-layer-testnet", canonical: "eip155:1952" },
  ];

  beforeEach(() => {
    mockDeps = {
      poolManager: {
        getSupportedNetworks: vi.fn(() => mockSupportedNetworks),
        getPool: vi.fn(() => ({})),
      } as any,
      enableV2: false,
      v2Signer: undefined,
      allowedRouters: undefined,
      rpcUrls: undefined,
    };

    app = express();
    app.use(express.json());
    app.use(createSupportedRoutes(mockDeps));
  });

  describe("GET /supported - v2-only behavior", () => {
    it("should return empty when v2 is not enabled", async () => {
      const response = await request(app).get("/supported");

      expect(response.status).toBe(200);
      expect(response.body.kinds).toEqual([]);
    });

    it("should return only v2 kinds when v2 is enabled", async () => {
      mockDeps.enableV2 = true;
      mockDeps.v2Signer = "0x1234567890123456789012345678901234567890";
      mockDeps.allowedRouters = {
        "eip155:84532": ["0x0000000000000000000000000000000000000001"],
        "eip155:1952": ["0x0000000000000000000000000000000000000002"],
      };

      app = express();
      app.use(createSupportedRoutes(mockDeps));

      const response = await request(app).get("/supported");

      expect(response.status).toBe(200);
      expect(response.body.kinds).toBeDefined();

      // Should have 2 kinds (v2 only, no v1)
      expect(response.body.kinds.length).toBe(2);

      // Check all kinds are v2 with CAIP-2 canonical names
      response.body.kinds.forEach((kind: any) => {
        expect(kind.x402Version).toBe(2);
        expect(kind.scheme).toBe("exact");
        expect(["eip155:84532", "eip155:1952"]).toContain(kind.network);
      });
    });

    it("should not include v1 kinds even when v2 is enabled", async () => {
      mockDeps.enableV2 = true;
      mockDeps.v2Signer = "0x1234567890123456789012345678901234567890";
      mockDeps.allowedRouters = {
        "eip155:84532": ["0x0000000000000000000000000000000000000001"],
        "eip155:1952": ["0x0000000000000000000000000000000000000002"],
      };

      app = express();
      app.use(createSupportedRoutes(mockDeps));

      const response = await request(app).get("/supported");

      // No v1 kinds should be present
      const v1Kinds = response.body.kinds.filter((k: any) => k.x402Version === 1);
      expect(v1Kinds.length).toBe(0);

      // All kinds should be v2
      const v2Kinds = response.body.kinds.filter((k: any) => k.x402Version === 2);
      expect(v2Kinds.length).toBe(2);
    });

    it("should include all required fields in payment kinds", async () => {
      mockDeps.enableV2 = true;
      mockDeps.v2Signer = "0x1234567890123456789012345678901234567890";
      mockDeps.allowedRouters = {
        "eip155:84532": ["0x0000000000000000000000000000000000000001"],
        "eip155:1952": ["0x0000000000000000000000000000000000000002"],
      };

      app = express();
      app.use(createSupportedRoutes(mockDeps));

      const response = await request(app).get("/supported");

      response.body.kinds.forEach((kind: any) => {
        expect(kind).toHaveProperty("x402Version", 2);
        expect(kind).toHaveProperty("scheme", "exact");
        expect(kind).toHaveProperty("network");
        expect(typeof kind.network).toBe("string");
      });
    });
  });

  describe("GET /supported - edge cases", () => {
    it("should return empty list when no networks are configured", async () => {
      vi.mocked(mockDeps.poolManager.getSupportedNetworks).mockReturnValue([]);

      const response = await request(app).get("/supported");

      expect(response.status).toBe(200);
      expect(response.body.kinds).toEqual([]);
    });

    it("should ignore query parameters (v2-only endpoint)", async () => {
      mockDeps.enableV2 = true;
      mockDeps.v2Signer = "0x1234567890123456789012345678901234567890";
      mockDeps.allowedRouters = {
        "eip155:84532": ["0x0000000000000000000000000000000000000001"],
        "eip155:1952": ["0x0000000000000000000000000000000000000002"],
      };

      app = express();
      app.use(createSupportedRoutes(mockDeps));

      // Query parameter should be ignored (endpoint is v2-only)
      const response = await request(app).get("/supported?network=eip155:84532");

      // Still returns all v2 kinds (not filtered by query)
      expect(response.body.kinds.length).toBe(2);
      response.body.kinds.forEach((kind: any) => {
        expect(kind.x402Version).toBe(2);
      });
    });

    it("should use exact scheme for all payment kinds", async () => {
      mockDeps.enableV2 = true;
      mockDeps.v2Signer = "0x1234567890123456789012345678901234567890";
      mockDeps.allowedRouters = {
        "eip155:84532": ["0x0000000000000000000000000000000000000001"],
        "eip155:1952": ["0x0000000000000000000000000000000000000002"],
      };

      app = express();
      app.use(createSupportedRoutes(mockDeps));

      const response = await request(app).get("/supported");

      response.body.kinds.forEach((kind: any) => {
        expect(kind.scheme).toBe("exact");
      });
    });

    it("should filter out networks without allowed routers when v2 is enabled", async () => {
      mockDeps.enableV2 = true;
      mockDeps.v2Signer = "0x1234567890123456789012345678901234567890";
      // Only configure routers for one network
      mockDeps.allowedRouters = {
        "eip155:84532": ["0x0000000000000000000000000000000000000001"],
        // eip155:1952 has no routers configured
      };

      app = express();
      app.use(createSupportedRoutes(mockDeps));

      const response = await request(app).get("/supported");

      // Only the network with routers should be advertised
      expect(response.body.kinds.length).toBe(1);
      expect(response.body.kinds[0].network).toBe("eip155:84532");
    });
  });

  describe("GET /supported - signer requirements", () => {
    it("should return empty when v2 enabled but no signer configured", async () => {
      mockDeps.enableV2 = true;
      mockDeps.v2Signer = undefined;
      mockDeps.allowedRouters = {
        "eip155:84532": ["0x0000000000000000000000000000000000000001"],
      };

      app = express();
      app.use(createSupportedRoutes(mockDeps));

      const response = await request(app).get("/supported");

      expect(response.body.kinds).toEqual([]);
    });

    it("should return kinds when v2 enabled with privateKey", async () => {
      mockDeps.enableV2 = true;
      mockDeps.v2Signer = undefined;
      mockDeps.v2PrivateKey = "0x1234567890123456789012345678901234567890123456789012345678901234";
      mockDeps.allowedRouters = {
        "eip155:84532": ["0x0000000000000000000000000000000000000001"],
      };

      app = express();
      app.use(createSupportedRoutes(mockDeps));

      const response = await request(app).get("/supported");

      expect(response.body.kinds.length).toBe(1);
      expect(response.body.kinds[0].x402Version).toBe(2);
    });
  });
});
