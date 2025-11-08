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

// Mock @x402x/core to return supported networks
vi.mock("@x402x/core", () => ({
  getSupportedNetworks: vi.fn(() => ["base-sepolia", "x-layer-testnet"]),
}));

describe("routes/supported", () => {
  let app: express.Application;
  let mockDeps: SupportedRouteDependencies;

  beforeEach(() => {
    mockDeps = {
      poolManager: {
        getEvmAccountCount: vi.fn(() => 2),
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
        ["base-sepolia", "x-layer-testnet"].includes(k.network),
      );
      expect(evmKinds.length).toBe(2);
    });

    it("should not return networks when no EVM accounts", async () => {
      vi.mocked(mockDeps.poolManager.getEvmAccountCount).mockReturnValue(0);

      const response = await request(app).get("/supported");

      expect(response.body.kinds.length).toBe(0);
    });

    it("should return empty list when no accounts configured", async () => {
      vi.mocked(mockDeps.poolManager.getEvmAccountCount).mockReturnValue(0);

      const response = await request(app).get("/supported");

      expect(response.status).toBe(200);
      expect(response.body.kinds).toEqual([]);
    });

    it("should include x402Version in payment kinds", async () => {
      const response = await request(app).get("/supported");

      expect(response.body.kinds.length).toBeGreaterThan(0);
      expect(response.body.kinds[0]).toHaveProperty("x402Version", 1);
    });

    it("should use exact scheme for all payment kinds", async () => {
      const response = await request(app).get("/supported");

      response.body.kinds.forEach((kind: any) => {
        expect(kind.scheme).toBe("exact");
      });
    });

    it("should include network names", async () => {
      const response = await request(app).get("/supported");

      response.body.kinds.forEach((kind: any) => {
        expect(kind.network).toBeDefined();
        expect(typeof kind.network).toBe("string");
      });
    });
  });
});
