import { describe, it, expect } from "vitest";
import { x402Client } from "@x402/core/client";
import { injectX402xExtensionHandler, registerX402xScheme } from "./extension-handler";
import type { ClientEvmSigner } from "./exact-evm-scheme";
import { ROUTER_SETTLEMENT_KEY } from "../server-extension";

describe("x402x Extension Handler", () => {
  describe("injectX402xExtensionHandler", () => {
    it("should return the same client instance for chaining", () => {
      const client = new x402Client();
      const result = injectX402xExtensionHandler(client);
      
      expect(result).toBe(client);
    });

    it("should not throw when called multiple times", () => {
      const client = new x402Client();
      
      expect(() => {
        injectX402xExtensionHandler(client);
        injectX402xExtensionHandler(client);
        injectX402xExtensionHandler(client);
      }).not.toThrow();
    });
  });

  describe("registerX402xScheme", () => {
    it("should return the client instance for chaining", () => {
      const client = new x402Client();
      const mockSigner: ClientEvmSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signTypedData: async () => "0xsignature" as `0x${string}`,
      };

      const result = registerX402xScheme(client, "eip155:84532", mockSigner);

      expect(result).toBe(client);
    });

    it("should allow multiple networks registration", () => {
      const client = new x402Client();
      const mockSigner: ClientEvmSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signTypedData: async () => "0xsignature" as `0x${string}`,
      };

      expect(() => {
        registerX402xScheme(client, "eip155:84532", mockSigner);
        registerX402xScheme(client, "eip155:8453", mockSigner);
      }).not.toThrow();
    });

    it("should support method chaining", () => {
      const client = new x402Client();
      const mockSigner: ClientEvmSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signTypedData: async () => "0xsignature" as `0x${string}`,
      };

      expect(() => {
        registerX402xScheme(client, "eip155:84532", mockSigner);
        // Chain with other x402Client methods
        client.onBeforePaymentCreation(async () => {});
      }).not.toThrow();
    });
  });

  describe("Integration", () => {
    it("should work with x402Client hooks", () => {
      const client = new x402Client();
      const mockSigner: ClientEvmSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signTypedData: async () => "0xsignature" as `0x${string}`,
      };

      let hookCalled = false;
      
      // Register x402x scheme
      registerX402xScheme(client, "eip155:84532", mockSigner);
      
      // Add another hook after registration
      client.onBeforePaymentCreation(async () => {
        hookCalled = true;
      });

      expect(hookCalled).toBe(false);
      // Hook should be registered successfully
    });

    it("should copy per-option x402x info from selectedRequirements.extra to paymentRequired.extensions", async () => {
      const client = new x402Client();
      let forwarded: unknown | undefined;

      injectX402xExtensionHandler(client, (ext) => {
        forwarded = ext;
      });

      const hooks = (client as unknown as { beforePaymentCreationHooks?: Array<(ctx: any) => any> })
        .beforePaymentCreationHooks;
      expect(Array.isArray(hooks)).toBe(true);
      const hook = hooks?.[0];
      expect(typeof hook).toBe("function");

      // v2 multi-network scenario: per-option x402x info in selectedRequirements.extra
      const ctx = {
        paymentRequired: {
          extensions: {}, // Initially empty or has other extensions
        },
        selectedRequirements: {
          extra: {
            name: "USDC",
            version: "2",
            [ROUTER_SETTLEMENT_KEY]: { 
              info: { 
                settlementRouter: "0xROUTER",
                salt: "0xSALT",
                hook: "0xHOOK",
                hookData: "0x",
                finalPayTo: "0xMERCHANT",
                facilitatorFee: "0",
              },
            },
          },
        },
      };

      await hook?.(ctx);

      // Should copy per-option x402x info into paymentRequired.extensions
      expect(ctx.paymentRequired.extensions[ROUTER_SETTLEMENT_KEY]).toEqual({
        info: {
          settlementRouter: "0xROUTER",
          salt: "0xSALT",
          hook: "0xHOOK",
          hookData: "0x",
          finalPayTo: "0xMERCHANT",
          facilitatorFee: "0",
        },
      });

      // Should forward the extension to callback
      expect(forwarded).toEqual({
        info: {
          settlementRouter: "0xROUTER",
          salt: "0xSALT",
          hook: "0xHOOK",
          hookData: "0x",
          finalPayTo: "0xMERCHANT",
          facilitatorFee: "0",
        },
      });

      // Ensure we didn't mutate selectedRequirements itself (which becomes paymentPayload.accepted)
      expect(ctx.selectedRequirements.extra[ROUTER_SETTLEMENT_KEY]).toBeDefined();
    });

    it("should use root-level extension as fallback when no per-option info", async () => {
      const client = new x402Client();
      let forwarded: unknown | undefined;

      injectX402xExtensionHandler(client, (ext) => {
        forwarded = ext;
      });

      const hooks = (client as unknown as { beforePaymentCreationHooks?: Array<(ctx: any) => any> })
        .beforePaymentCreationHooks;
      const hook = hooks?.[0];

      // Legacy scenario: only root-level extension, no per-option info
      const ctx = {
        paymentRequired: {
          extensions: {
            [ROUTER_SETTLEMENT_KEY]: { info: { settlementRouter: "0x0" } },
          },
        },
        selectedRequirements: {
          extra: { name: "USDC", version: "2" }, // No x402x info here
        },
      };

      await hook?.(ctx);

      // Should forward root-level extension to callback
      expect(forwarded).toEqual({ info: { settlementRouter: "0x0" } });
      
      // Root extension should remain unchanged
      expect(ctx.paymentRequired.extensions[ROUTER_SETTLEMENT_KEY]).toEqual({
        info: { settlementRouter: "0x0" },
      });
    });
  });
});

