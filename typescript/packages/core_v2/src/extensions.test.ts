/**
 * Tests for extension helpers
 */

import { describe, it, expect } from "vitest";
import {
  createRouterSettlementExtension,
  getRouterSettlementExtensionKey,
  type RouterSettlementExtension,
} from "./extensions";

describe("createRouterSettlementExtension", () => {
  it("should create extension with default schema version", () => {
    const extension = createRouterSettlementExtension();

    expect(extension).toEqual({
      info: {
        schemaVersion: 1,
        description: undefined,
      },
      schema: undefined,
    });
  });

  it("should create extension with description", () => {
    const extension = createRouterSettlementExtension({
      description: "Settlement router with atomic fee distribution",
    });

    expect(extension).toEqual({
      info: {
        schemaVersion: 1,
        description: "Settlement router with atomic fee distribution",
      },
      schema: undefined,
    });
  });

  it("should create extension with schema", () => {
    const schema = {
      type: "object",
      properties: {
        settlementRouter: { type: "string" },
      },
    };

    const extension = createRouterSettlementExtension({ schema });

    expect(extension).toEqual({
      info: {
        schemaVersion: 1,
        description: undefined,
      },
      schema,
    });
  });

  it("should create extension with both description and schema", () => {
    const schema = {
      type: "object",
      properties: {
        settlementRouter: { type: "string" },
      },
    };

    const extension = createRouterSettlementExtension({
      description: "Custom settlement",
      schema,
    });

    expect(extension).toEqual({
      info: {
        schemaVersion: 1,
        description: "Custom settlement",
      },
      schema,
    });
  });

  it("should have correct structure for PaymentRequired.extensions", () => {
    const extension = createRouterSettlementExtension({
      description: "Test extension",
    });

    // Simulate usage in PaymentRequired
    const paymentRequired = {
      x402Version: 2,
      resource: { url: "/api/payment", description: "Test", mimeType: "text/plain" },
      accepts: [],
      extensions: {
        [getRouterSettlementExtensionKey()]: extension,
      },
    };

    expect(paymentRequired.extensions["x402x-router-settlement"]).toEqual(extension);
    expect(paymentRequired.extensions["x402x-router-settlement"].info.schemaVersion).toBe(1);
  });
});

describe("getRouterSettlementExtensionKey", () => {
  it("should return correct extension key", () => {
    expect(getRouterSettlementExtensionKey()).toBe("x402x-router-settlement");
  });
});
