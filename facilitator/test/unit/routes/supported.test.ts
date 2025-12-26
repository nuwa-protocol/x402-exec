/**
 * Tests for routes/supported.ts
 *
 * Tests supported payment kinds endpoint with v1/v2 support
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  createSupportedRoutes,
  type SupportedRouteDependencies,
} from "../../../src/routes/supported.js";

describe("routes/supported", () => {
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
        // isNetworkReady() now checks pool existence via getPool()
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

  describe("GET /supported - v1-only mode", () => {
    it("should return only v1 kinds when v2 is disabled", async () => {
      const response = await request(app).get("/supported");

      expect(response.status).toBe(200);
      expect(response.body.kinds).toBeDefined();
      expect(response.body.kinds.length).toBe(2);

      // Check that all kinds are v1 with human-readable network names
      response.body.kinds.forEach((kind: any) => {
        expect(kind.x402Version).toBe(1);
        expect(kind.scheme).toBe("exact");
        expect(["base-sepolia", "x-layer-testnet"]).toContain(kind.network);
      });
    });

    it("should not include v2 kinds when v2Signer is missing", async () => {
      mockDeps.enableV2 = true; // But no signer
      app = express();
      app.use(createSupportedRoutes(mockDeps));

      const response = await request(app).get("/supported");

      expect(response.body.kinds.length).toBe(2);
      response.body.kinds.forEach((kind: any) => {
        expect(kind.x402Version).toBe(1);
      });
    });
  });

  describe("GET /supported - v2-enabled mode", () => {
    beforeEach(() => {
      mockDeps.enableV2 = true;
      mockDeps.v2Signer = "0x1234567890123456789012345678901234567890";
      // In v2 mode, /supported filters out networks without configured routers.
      mockDeps.allowedRouters = {
        "eip155:84532": ["0x0000000000000000000000000000000000000001"],
        "eip155:1952": ["0x0000000000000000000000000000000000000002"],
      };

      app = express();
      app.use(createSupportedRoutes(mockDeps));
    });

    it("should return both v1 and v2 kinds when v2 is properly configured", async () => {
      const response = await request(app).get("/supported");

      expect(response.status).toBe(200);
      expect(response.body.kinds).toBeDefined();

      // Should have 4 kinds: 2 v1 + 2 v2
      expect(response.body.kinds.length).toBe(4);

      // Check v1 kinds with human-readable names
      const v1Kinds = response.body.kinds.filter((k: any) => k.x402Version === 1);
      expect(v1Kinds.length).toBe(2);
      v1Kinds.forEach((kind: any) => {
        expect(kind.scheme).toBe("exact");
        expect(["base-sepolia", "x-layer-testnet"]).toContain(kind.network);
      });

      // Check v2 kinds with CAIP-2 canonical names
      const v2Kinds = response.body.kinds.filter((k: any) => k.x402Version === 2);
      expect(v2Kinds.length).toBe(2);
      v2Kinds.forEach((kind: any) => {
        expect(kind.scheme).toBe("exact");
        expect(["eip155:84532", "eip155:1952"]).toContain(kind.network);
      });
    });

    it("should include all required fields in payment kinds", async () => {
      const response = await request(app).get("/supported");

      response.body.kinds.forEach((kind: any) => {
        expect(kind).toHaveProperty("x402Version");
        expect(kind).toHaveProperty("scheme", "exact");
        expect(kind).toHaveProperty("network");
        expect(typeof kind.network).toBe("string");
      });
    });
  });

  describe("GET /supported - version filtering", () => {
    beforeEach(() => {
      mockDeps.enableV2 = true;
      mockDeps.v2Signer = "0x1234567890123456789012345678901234567890";
      // In v2 mode, /supported filters out networks without configured routers.
      mockDeps.allowedRouters = {
        "eip155:84532": ["0x0000000000000000000000000000000000000001"],
        "eip155:1952": ["0x0000000000000000000000000000000000000002"],
      };

      app = express();
      app.use(createSupportedRoutes(mockDeps));
    });

    it("should return only v1 kinds when ?x402Version=1", async () => {
      const response = await request(app).get("/supported?x402Version=1");

      expect(response.body.kinds.length).toBe(2);
      response.body.kinds.forEach((kind: any) => {
        expect(kind.x402Version).toBe(1);
        expect(kind.scheme).toBe("exact");
        expect(["base-sepolia", "x-layer-testnet"]).toContain(kind.network);
      });
    });

    it("should return only v2 kinds when ?x402Version=2", async () => {
      const response = await request(app).get("/supported?x402Version=2");

      expect(response.body.kinds.length).toBe(2);
      response.body.kinds.forEach((kind: any) => {
        expect(kind.x402Version).toBe(2);
        expect(kind.scheme).toBe("exact");
        expect(["eip155:84532", "eip155:1952"]).toContain(kind.network);
      });
    });

    it("should return both versions when no filter is provided", async () => {
      const response = await request(app).get("/supported");

      expect(response.body.kinds.length).toBe(4);

      const v1Kinds = response.body.kinds.filter((k: any) => k.x402Version === 1);
      const v2Kinds = response.body.kinds.filter((k: any) => k.x402Version === 2);
      expect(v1Kinds.length).toBe(2);
      expect(v2Kinds.length).toBe(2);
    });
  });

  describe("GET /supported - filtering with v2 disabled", () => {
    it("should return empty when ?x402Version=2 but v2 is disabled", async () => {
      // v2 is disabled by default in beforeEach
      const response = await request(app).get("/supported?x402Version=2");

      expect(response.status).toBe(200);
      expect(response.body.kinds).toEqual([]);
    });

    it("should return v1 kinds when ?x402Version=1 even when v2 is disabled", async () => {
      const response = await request(app).get("/supported?x402Version=1");

      expect(response.body.kinds.length).toBe(2);
      response.body.kinds.forEach((kind: any) => {
        expect(kind.x402Version).toBe(1);
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

    it("should handle invalid version filter gracefully", async () => {
      // Invalid version should return empty (no kinds match)
      const response = await request(app).get("/supported?x402Version=3");

      expect(response.status).toBe(200);
      expect(response.body.kinds).toEqual([]);
    });

    it("should use exact scheme for all payment kinds", async () => {
      const response = await request(app).get("/supported");

      response.body.kinds.forEach((kind: any) => {
        expect(kind.scheme).toBe("exact");
      });
    });
  });
});
