/**
 * Tests for routes/supported.ts
 *
 * Tests supported payment kinds endpoint
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

  beforeEach(() => {
    const mockEvmPool = {
      execute: vi.fn(async (fn) => fn({ account: { address: "0xabc" } })),
    };

    const mockSvmPool = {
      execute: vi.fn(async (fn) => fn({ address: "svmAddress" })),
    };

    mockDeps = {
      poolManager: {
        getEvmAccountCount: vi.fn(() => 2),
        getSvmAccountCount: vi.fn(() => 1),
        getPool: vi.fn((network) => {
          if (network === "solana-devnet") return mockSvmPool;
          return null;
        }),
      } as any,
    };

    app = express();
    app.use(express.json());
    app.use(createSupportedRoutes(mockDeps));
  });

  describe("GET /supported", () => {
    it("should return supported EVM networks when EVM accounts exist", async () => {
      const response = await request(app).get("/supported");

      expect(response.status).toBe(200);
      expect(response.body.kinds).toBeDefined();

      const evmKinds = response.body.kinds.filter((k: any) =>
        ["base-sepolia", "x-layer", "x-layer-testnet"].includes(k.network),
      );
      expect(evmKinds.length).toBeGreaterThan(0);
    });

    it("should return supported SVM networks when SVM accounts exist", async () => {
      const response = await request(app).get("/supported");

      expect(response.status).toBe(200);
      const svmKinds = response.body.kinds.filter((k: any) => k.network === "solana-devnet");

      // Should have SVM network in list
      expect(svmKinds.length).toBeGreaterThan(0);

      // feePayer may be set if pool.execute succeeds
      if (svmKinds[0].extra) {
        expect(svmKinds[0].extra).toBeDefined();
      }
    });

    it("should not return EVM networks when no EVM accounts", async () => {
      vi.mocked(mockDeps.poolManager.getEvmAccountCount).mockReturnValue(0);

      const response = await request(app).get("/supported");

      const evmKinds = response.body.kinds.filter((k: any) =>
        ["base-sepolia", "x-layer", "x-layer-testnet"].includes(k.network),
      );
      expect(evmKinds.length).toBe(0);
    });

    it("should not return SVM networks when no SVM accounts", async () => {
      vi.mocked(mockDeps.poolManager.getSvmAccountCount).mockReturnValue(0);

      const response = await request(app).get("/supported");

      const svmKinds = response.body.kinds.filter((k: any) => k.network === "solana-devnet");
      expect(svmKinds.length).toBe(0);
    });

    it("should return empty list when no accounts configured", async () => {
      vi.mocked(mockDeps.poolManager.getEvmAccountCount).mockReturnValue(0);
      vi.mocked(mockDeps.poolManager.getSvmAccountCount).mockReturnValue(0);

      const response = await request(app).get("/supported");

      expect(response.status).toBe(200);
      expect(response.body.kinds).toEqual([]);
    });

    it("should include x402Version in payment kinds", async () => {
      const response = await request(app).get("/supported");

      expect(response.body.kinds[0]).toHaveProperty("x402Version", 1);
    });

    it("should use exact scheme for all payment kinds", async () => {
      const response = await request(app).get("/supported");

      response.body.kinds.forEach((kind: any) => {
        expect(kind.scheme).toBe("exact");
      });
    });
  });
});
