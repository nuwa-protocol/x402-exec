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

    it("should forward root-level extension to callback without mutating accepted", async () => {
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

      const ctx = {
        paymentRequired: {
          extensions: {
            [ROUTER_SETTLEMENT_KEY]: { info: { settlementRouter: "0x0" } },
          },
        },
        selectedRequirements: {
          extra: { name: "USDC", version: "2" },
        },
      };

      await hook?.(ctx);

      expect(forwarded).toEqual({ info: { settlementRouter: "0x0" } });
      // Ensure we didn't mutate accepted requirements
      expect(ctx.selectedRequirements.extra[ROUTER_SETTLEMENT_KEY]).toBeUndefined();
    });
  });
});

