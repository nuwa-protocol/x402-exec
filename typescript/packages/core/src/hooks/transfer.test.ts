import { describe, it, expect } from "vitest";
import { TransferHook, type Split } from "./transfer";
import { networks } from "../networks";

describe("TransferHook.encode", () => {
  describe("Simple Transfer Mode", () => {
    it("should return empty bytes with no parameters", () => {
      const hookData = TransferHook.encode();

      expect(hookData).toBe("0x");
    });

    it("should return empty bytes with empty array", () => {
      const hookData = TransferHook.encode([]);

      expect(hookData).toBe("0x");
    });

    it("should always return the same value", () => {
      const hookData1 = TransferHook.encode();
      const hookData2 = TransferHook.encode();

      expect(hookData1).toBe(hookData2);
    });
  });

  describe("Distributed Transfer Mode", () => {
    it("should encode single split", () => {
      const splits: Split[] = [
        {
          recipient: "0x1234567890123456789012345678901234567890" as any,
          bips: 5000, // 50%
        },
      ];

      const hookData = TransferHook.encode(splits);

      expect(hookData).toMatch(/^0x[0-9a-f]+$/i);
      expect(hookData).not.toBe("0x");
    });

    it("should encode multiple splits", () => {
      const splits: Split[] = [
        {
          recipient: "0x1111111111111111111111111111111111111111" as any,
          bips: 6000, // 60%
        },
        {
          recipient: "0x2222222222222222222222222222222222222222" as any,
          bips: 4000, // 40%
        },
      ];

      const hookData = TransferHook.encode(splits);

      expect(hookData).toMatch(/^0x[0-9a-f]+$/i);
      expect(hookData).not.toBe("0x");
    });

    it("should encode partial splits (< 100%)", () => {
      const splits: Split[] = [
        {
          recipient: "0x1111111111111111111111111111111111111111" as any,
          bips: 3000, // 30%
        },
      ];

      const hookData = TransferHook.encode(splits);

      expect(hookData).toMatch(/^0x[0-9a-f]+$/i);
      // Remaining 70% goes to payTo
    });

    it("should encode full splits (100%)", () => {
      const splits: Split[] = [
        {
          recipient: "0x1111111111111111111111111111111111111111" as any,
          bips: 10000, // 100%
        },
      ];

      const hookData = TransferHook.encode(splits);

      expect(hookData).toMatch(/^0x[0-9a-f]+$/i);
      // payTo receives 0%
    });

    it("should encode complex multi-recipient splits", () => {
      const splits: Split[] = [
        {
          recipient: "0x1111111111111111111111111111111111111111" as any,
          bips: 2500, // 25%
        },
        {
          recipient: "0x2222222222222222222222222222222222222222" as any,
          bips: 2500, // 25%
        },
        {
          recipient: "0x3333333333333333333333333333333333333333" as any,
          bips: 2500, // 25%
        },
        {
          recipient: "0x4444444444444444444444444444444444444444" as any,
          bips: 2500, // 25%
        },
      ];

      const hookData = TransferHook.encode(splits);

      expect(hookData).toMatch(/^0x[0-9a-f]+$/i);
      expect(hookData.length).toBeGreaterThan(10); // Should be substantial
    });
  });

  describe("Validation", () => {
    it("should throw error for total bips > 10000", () => {
      const splits: Split[] = [
        {
          recipient: "0x1111111111111111111111111111111111111111" as any,
          bips: 6000,
        },
        {
          recipient: "0x2222222222222222222222222222222222222222" as any,
          bips: 5000,
        },
      ];

      expect(() => TransferHook.encode(splits)).toThrow("Total bips (11000) exceeds 10000");
    });

    it("should throw error for zero address", () => {
      const splits: Split[] = [
        {
          recipient: "0x0000000000000000000000000000000000000000" as any,
          bips: 5000,
        },
      ];

      expect(() => TransferHook.encode(splits)).toThrow("Invalid recipient address");
    });

    it("should throw error for zero bips", () => {
      const splits: Split[] = [
        {
          recipient: "0x1111111111111111111111111111111111111111" as any,
          bips: 0,
        },
      ];

      expect(() => TransferHook.encode(splits)).toThrow("Bips must be greater than 0");
    });

    it("should throw error for negative bips", () => {
      const splits: Split[] = [
        {
          recipient: "0x1111111111111111111111111111111111111111" as any,
          bips: -100,
        },
      ];

      expect(() => TransferHook.encode(splits)).toThrow("Bips must be greater than 0");
    });

    it("should throw error for individual bips > 10000", () => {
      const splits: Split[] = [
        {
          recipient: "0x1111111111111111111111111111111111111111" as any,
          bips: 15000,
        },
      ];

      expect(() => TransferHook.encode(splits)).toThrow(
        "Individual bips cannot exceed 10000, got: 15000",
      );
    });
  });
});

describe("TransferHook.getAddress", () => {
  it("should return address for base-sepolia", () => {
    const address = TransferHook.getAddress("base-sepolia");

    expect(address).toBeDefined();
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(address).toBe(networks["base-sepolia"].hooks.transfer);
  });

  it("should return address for x-layer-testnet", () => {
    const address = TransferHook.getAddress("x-layer-testnet");

    expect(address).toBeDefined();
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(address).toBe(networks["x-layer-testnet"].hooks.transfer);
  });

  it("should throw error for unsupported network", () => {
    expect(() => {
      TransferHook.getAddress("unsupported-network");
    }).toThrow();
  });

  it("should return different addresses for different networks", () => {
    const addressBaseSepolia = TransferHook.getAddress("base-sepolia");
    const addressXLayer = TransferHook.getAddress("x-layer-testnet");

    expect(addressBaseSepolia).not.toBe(addressXLayer);
  });

  it("should return consistent address for same network", () => {
    const address1 = TransferHook.getAddress("base-sepolia");
    const address2 = TransferHook.getAddress("base-sepolia");

    expect(address1).toBe(address2);
  });

  it("should throw descriptive error for invalid network", () => {
    expect(() => {
      TransferHook.getAddress("invalid-network");
    }).toThrow("Unsupported network");
  });

  it("should return valid Ethereum address format", () => {
    const address = TransferHook.getAddress("base-sepolia");

    // Check format: 0x followed by 40 hex characters
    expect(address.length).toBe(42);
    expect(address.startsWith("0x")).toBe(true);
    expect(/^0x[0-9a-fA-F]{40}$/.test(address)).toBe(true);
  });
});
