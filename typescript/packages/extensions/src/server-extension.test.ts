/**
 * Tests for server extension functionality
 */

import { describe, it, expect } from "vitest";

import { createRouterSettlementExtension } from "./extensions.js";
import {
  routerSettlementServerExtension,
  createExtensionDeclaration,
  ROUTER_SETTLEMENT_KEY,
} from "./server-extension.js";

describe("Server Extension", () => {
  describe("routerSettlementServerExtension", () => {
    it("should have correct key", () => {
      expect(routerSettlementServerExtension.key).toBe(ROUTER_SETTLEMENT_KEY);
      expect(routerSettlementServerExtension.key).toBe("x402x-router-settlement");
    });

    it("should have enrichDeclaration function", () => {
      expect(routerSettlementServerExtension.enrichDeclaration).toBeDefined();
      expect(typeof routerSettlementServerExtension.enrichDeclaration).toBe("function");
    });

    it("should enrich declaration with proper structure", () => {
      const declaration = {
        info: {
          description: "Test extension",
        },
      };

      const enriched = routerSettlementServerExtension.enrichDeclaration?.(declaration, {});

      expect(enriched).toBeDefined();
      expect((enriched as any).info).toBeDefined();
      expect((enriched as any).info.schemaVersion).toBe(1);
    });

    it("should preserve existing info fields", () => {
      const declaration = {
        info: {
          schemaVersion: 1,
          description: "Custom description",
          customField: "custom value",
        },
        schema: {
          type: "object",
        },
      };

      const enriched = routerSettlementServerExtension.enrichDeclaration?.(declaration, {});

      expect((enriched as any).info.description).toBe("Custom description");
      expect((enriched as any).info.customField).toBe("custom value");
      expect((enriched as any).schema).toEqual({ type: "object" });
    });

    it("should handle HTTP context", () => {
      const declaration = { info: {} };
      const httpContext = {
        method: "GET",
        adapter: "hono",
        url: "/api/test",
      };

      const enriched = routerSettlementServerExtension.enrichDeclaration?.(
        declaration,
        httpContext,
      );

      expect(enriched).toBeDefined();
      expect((enriched as any).info.schemaVersion).toBe(1);
    });
  });

  describe("createExtensionDeclaration", () => {
    it("should create extension declaration with correct key", () => {
      const declaration = createExtensionDeclaration();

      expect(declaration).toBeDefined();
      expect(declaration[ROUTER_SETTLEMENT_KEY]).toBeDefined();
    });

    it("should include proper structure", () => {
      const declaration = createExtensionDeclaration({
        description: "Test router settlement",
      });

      const extension = declaration[ROUTER_SETTLEMENT_KEY];
      expect(extension.info).toBeDefined();
      expect(extension.info.schemaVersion).toBe(1);
      expect(extension.info.description).toBe("Test router settlement");
    });

    it("should support schema parameter", () => {
      const schema = {
        type: "object",
        properties: {
          test: { type: "string" },
        },
      };

      const declaration = createExtensionDeclaration({ schema });

      const extension = declaration[ROUTER_SETTLEMENT_KEY];
      expect(extension.schema).toEqual(schema);
    });

    it("should work without parameters", () => {
      const declaration = createExtensionDeclaration();

      const extension = declaration[ROUTER_SETTLEMENT_KEY];
      expect(extension.info.schemaVersion).toBe(1);
      expect(extension.info.description).toBeUndefined();
      expect(extension.schema).toBeUndefined();
    });
  });

  describe("Integration with createRouterSettlementExtension", () => {
    it("should be compatible with createRouterSettlementExtension", () => {
      const extension1 = createExtensionDeclaration({ description: "Test" });
      const extension2 = createRouterSettlementExtension({ description: "Test" });

      expect(extension1[ROUTER_SETTLEMENT_KEY]).toEqual(extension2);
    });
  });
});
