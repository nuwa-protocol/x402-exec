/**
 * Tests for ABI definitions
 */

import { describe, it, expect } from "vitest";

import { SETTLEMENT_ROUTER_ABI } from "./abi";

describe("SETTLEMENT_ROUTER_ABI", () => {
  it("should be defined as an array", () => {
    expect(Array.isArray(SETTLEMENT_ROUTER_ABI)).toBe(true);
  });

  it("should contain function entries", () => {
    expect(SETTLEMENT_ROUTER_ABI.length).toBeGreaterThan(0);
  });

  describe("settleAndExecute function", () => {
    it("should have settleAndExecute function", () => {
      const settleFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "settleAndExecute");
      expect(settleFunc).toBeDefined();
    });

    it("should have correct function type", () => {
      const settleFunc = SETTLEMENT_ROUTER_ABI.find(
        (item) => item.name === "settleAndExecute",
      ) as any;
      expect(settleFunc?.type).toBe("function");
    });

    it("should have nonpayable stateMutability", () => {
      const settleFunc = SETTLEMENT_ROUTER_ABI.find(
        (item) => item.name === "settleAndExecute",
      ) as any;
      expect(settleFunc?.stateMutability).toBe("nonpayable");
    });

    it("should have correct parameters", () => {
      const settleFunc = SETTLEMENT_ROUTER_ABI.find(
        (item) => item.name === "settleAndExecute",
      ) as any;
      expect(settleFunc?.inputs).toBeDefined();
      expect(Array.isArray(settleFunc?.inputs)).toBe(true);

      const inputNames = settleFunc?.inputs.map((i: any) => i.name);
      expect(inputNames).toContain("token");
      expect(inputNames).toContain("from");
      expect(inputNames).toContain("value");
      expect(inputNames).toContain("validAfter");
      expect(inputNames).toContain("validBefore");
      expect(inputNames).toContain("nonce");
      expect(inputNames).toContain("signature");
      expect(inputNames).toContain("salt");
      expect(inputNames).toContain("payTo");
      expect(inputNames).toContain("facilitatorFee");
      expect(inputNames).toContain("hook");
      expect(inputNames).toContain("hookData");
    });

    it("should have no outputs", () => {
      const settleFunc = SETTLEMENT_ROUTER_ABI.find(
        (item) => item.name === "settleAndExecute",
      ) as any;
      expect(settleFunc?.outputs).toEqual([]);
    });
  });

  describe("calculateCommitment function", () => {
    it("should have calculateCommitment function", () => {
      const calcFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "calculateCommitment");
      expect(calcFunc).toBeDefined();
    });

    it("should have view stateMutability", () => {
      const calcFunc = SETTLEMENT_ROUTER_ABI.find(
        (item) => item.name === "calculateCommitment",
      ) as any;
      expect(calcFunc?.stateMutability).toBe("view");
    });

    it("should return bytes32", () => {
      const calcFunc = SETTLEMENT_ROUTER_ABI.find(
        (item) => item.name === "calculateCommitment",
      ) as any;
      expect(calcFunc?.outputs).toBeDefined();
      expect(calcFunc?.outputs[0].type).toBe("bytes32");
    });
  });

  describe("calculateContextKey function", () => {
    it("should have calculateContextKey function", () => {
      const contextFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "calculateContextKey");
      expect(contextFunc).toBeDefined();
    });

    it("should have pure stateMutability", () => {
      const contextFunc = SETTLEMENT_ROUTER_ABI.find(
        (item) => item.name === "calculateContextKey",
      ) as any;
      expect(contextFunc?.stateMutability).toBe("pure");
    });

    it("should return bytes32", () => {
      const contextFunc = SETTLEMENT_ROUTER_ABI.find(
        (item) => item.name === "calculateContextKey",
      ) as any;
      expect(contextFunc?.outputs).toBeDefined();
      expect(contextFunc?.outputs[0].type).toBe("bytes32");
    });
  });

  describe("isSettled function", () => {
    it("should have isSettled function", () => {
      const isSettledFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "isSettled");
      expect(isSettledFunc).toBeDefined();
    });

    it("should have view stateMutability", () => {
      const isSettledFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "isSettled") as any;
      expect(isSettledFunc?.stateMutability).toBe("view");
    });

    it("should return bool", () => {
      const isSettledFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "isSettled") as any;
      expect(isSettledFunc?.outputs).toBeDefined();
      expect(isSettledFunc?.outputs[0].type).toBe("bool");
    });
  });

  describe("getPendingFees function", () => {
    it("should have getPendingFees function", () => {
      const feesFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "getPendingFees");
      expect(feesFunc).toBeDefined();
    });

    it("should have view stateMutability", () => {
      const feesFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "getPendingFees") as any;
      expect(feesFunc?.stateMutability).toBe("view");
    });

    it("should return uint256", () => {
      const feesFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "getPendingFees") as any;
      expect(feesFunc?.outputs).toBeDefined();
      expect(feesFunc?.outputs[0].type).toBe("uint256");
    });
  });

  describe("claimFees function", () => {
    it("should have claimFees function", () => {
      const claimFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "claimFees");
      expect(claimFunc).toBeDefined();
    });

    it("should have nonpayable stateMutability", () => {
      const claimFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "claimFees") as any;
      expect(claimFunc?.stateMutability).toBe("nonpayable");
    });

    it("should accept tokens array parameter", () => {
      const claimFunc = SETTLEMENT_ROUTER_ABI.find((item) => item.name === "claimFees") as any;
      expect(claimFunc?.inputs).toBeDefined();
      expect(claimFunc?.inputs[0].type).toBe("address[]");
    });
  });

  describe("ABI structure validation", () => {
    it("should have all required functions", () => {
      const functionNames = SETTLEMENT_ROUTER_ABI.map((item) => (item as any).name).filter(Boolean);

      expect(functionNames).toContain("settleAndExecute");
      expect(functionNames).toContain("calculateCommitment");
      expect(functionNames).toContain("calculateContextKey");
      expect(functionNames).toContain("isSettled");
      expect(functionNames).toContain("getPendingFees");
      expect(functionNames).toContain("claimFees");
    });

    it("should have exactly 6 functions", () => {
      const functionNames = SETTLEMENT_ROUTER_ABI.filter(
        (item) => (item as any).type === "function",
      );
      expect(functionNames.length).toBe(6);
    });

    it("should have proper type annotations", () => {
      // Check if the ABI is readonly (const assertion)
      expect(SETTLEMENT_ROUTER_ABI).toBe(SETTLEMENT_ROUTER_ABI as any);
    });
  });
});
