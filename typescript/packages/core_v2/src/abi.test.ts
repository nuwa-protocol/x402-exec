/**
 * Tests for ABI definitions
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SETTLEMENT_ROUTER_ABI } from "./abi";

describe("abi", () => {
  describe("SETTLEMENT_ROUTER_ABI", () => {
    it("should export SETTLEMENT_ROUTER_ABI", () => {
      expect(SETTLEMENT_ROUTER_ABI).toBeDefined();
      expect(Array.isArray(SETTLEMENT_ROUTER_ABI)).toBe(true);
    });

    it("should contain the expected number of functions", () => {
      expect(SETTLEMENT_ROUTER_ABI).toHaveLength(3);
    });

    describe("settleAndExecute function", () => {
      let settleFunction: any;

      beforeEach(() => {
        settleFunction = SETTLEMENT_ROUTER_ABI.find(
          (func: any) => func.name === "settleAndExecute"
        );
      });

      it("should contain settleAndExecute function", () => {
        expect(settleFunction).toBeDefined();
        expect(settleFunction.type).toBe("function");
        expect(settleFunction.name).toBe("settleAndExecute");
      });

      it("should have correct stateMutability", () => {
        expect(settleFunction.stateMutability).toBe("nonpayable");
      });

      it("should have correct inputs count", () => {
        expect(settleFunction.inputs).toHaveLength(12);
      });

      it("should have token input", () => {
        const tokenInput = settleFunction.inputs.find(
          (input: any) => input.name === "token"
        );
        expect(tokenInput).toBeDefined();
        expect(tokenInput.type).toBe("address");
      });

      it("should have from input", () => {
        const fromInput = settleFunction.inputs.find(
          (input: any) => input.name === "from"
        );
        expect(fromInput).toBeDefined();
        expect(fromInput.type).toBe("address");
      });

      it("should have value input", () => {
        const valueInput = settleFunction.inputs.find(
          (input: any) => input.name === "value"
        );
        expect(valueInput).toBeDefined();
        expect(valueInput.type).toBe("uint256");
      });

      it("should have validAfter input", () => {
        const validAfterInput = settleFunction.inputs.find(
          (input: any) => input.name === "validAfter"
        );
        expect(validAfterInput).toBeDefined();
        expect(validAfterInput.type).toBe("uint256");
      });

      it("should have validBefore input", () => {
        const validBeforeInput = settleFunction.inputs.find(
          (input: any) => input.name === "validBefore"
        );
        expect(validBeforeInput).toBeDefined();
        expect(validBeforeInput.type).toBe("uint256");
      });

      it("should have nonce input", () => {
        const nonceInput = settleFunction.inputs.find(
          (input: any) => input.name === "nonce"
        );
        expect(nonceInput).toBeDefined();
        expect(nonceInput.type).toBe("bytes32");
      });

      it("should have signature input", () => {
        const signatureInput = settleFunction.inputs.find(
          (input: any) => input.name === "signature"
        );
        expect(signatureInput).toBeDefined();
        expect(signatureInput.type).toBe("bytes");
      });

      it("should have salt input", () => {
        const saltInput = settleFunction.inputs.find(
          (input: any) => input.name === "salt"
        );
        expect(saltInput).toBeDefined();
        expect(saltInput.type).toBe("bytes32");
      });

      it("should have payTo input", () => {
        const payToInput = settleFunction.inputs.find(
          (input: any) => input.name === "payTo"
        );
        expect(payToInput).toBeDefined();
        expect(payToInput.type).toBe("address");
      });

      it("should have facilitatorFee input", () => {
        const facilitatorFeeInput = settleFunction.inputs.find(
          (input: any) => input.name === "facilitatorFee"
        );
        expect(facilitatorFeeInput).toBeDefined();
        expect(facilitatorFeeInput.type).toBe("uint256");
      });

      it("should have hook input", () => {
        const hookInput = settleFunction.inputs.find(
          (input: any) => input.name === "hook"
        );
        expect(hookInput).toBeDefined();
        expect(hookInput.type).toBe("address");
      });

      it("should have hookData input", () => {
        const hookDataInput = settleFunction.inputs.find(
          (input: any) => input.name === "hookData"
        );
        expect(hookDataInput).toBeDefined();
        expect(hookDataInput.type).toBe("bytes");
      });

      it("should have no outputs", () => {
        expect(settleFunction.outputs).toHaveLength(0);
      });

      it("should have inputs in the correct order", () => {
        const expectedOrder = [
          "token",
          "from",
          "value",
          "validAfter",
          "validBefore",
          "nonce",
          "signature",
          "salt",
          "payTo",
          "facilitatorFee",
          "hook",
          "hookData",
        ];

        expect(settleFunction.inputs.map((input: any) => input.name)).toEqual(
          expectedOrder
        );
      });

      it("should have the correct types in order", () => {
        const expectedTypes = [
          "address",
          "address",
          "uint256",
          "uint256",
          "uint256",
          "bytes32",
          "bytes",
          "bytes32",
          "address",
          "uint256",
          "address",
          "bytes",
        ];

        expect(settleFunction.inputs.map((input: any) => input.type)).toEqual(
          expectedTypes
        );
      });
    });

    describe("getPendingFees function", () => {
      let getPendingFeesFunction: any;

      beforeEach(() => {
        getPendingFeesFunction = SETTLEMENT_ROUTER_ABI.find(
          (func: any) => func.name === "getPendingFees"
        );
      });

      it("should contain getPendingFees function", () => {
        expect(getPendingFeesFunction).toBeDefined();
        expect(getPendingFeesFunction.type).toBe("function");
        expect(getPendingFeesFunction.name).toBe("getPendingFees");
      });

      it("should have correct stateMutability", () => {
        expect(getPendingFeesFunction.stateMutability).toBe("view");
      });

      it("should have facilitator input", () => {
        const facilitatorInput = getPendingFeesFunction.inputs.find(
          (input: any) => input.name === "facilitator"
        );
        expect(facilitatorInput).toBeDefined();
        expect(facilitatorInput.type).toBe("address");
      });

      it("should have token input", () => {
        const tokenInput = getPendingFeesFunction.inputs.find(
          (input: any) => input.name === "token"
        );
        expect(tokenInput).toBeDefined();
        expect(tokenInput.type).toBe("address");
      });

      it("should have correct number of inputs", () => {
        expect(getPendingFeesFunction.inputs).toHaveLength(2);
      });

      it("should have single output", () => {
        expect(getPendingFeesFunction.outputs).toHaveLength(1);
      });

      it("should have uint256 output type", () => {
        expect(getPendingFeesFunction.outputs[0].type).toBe("uint256");
      });

      it("should have inputs in the correct order", () => {
        const expectedOrder = ["facilitator", "token"];
        expect(getPendingFeesFunction.inputs.map((input: any) => input.name)).toEqual(
          expectedOrder
        );
      });
    });

    describe("claimFees function", () => {
      let claimFeesFunction: any;

      beforeEach(() => {
        claimFeesFunction = SETTLEMENT_ROUTER_ABI.find(
          (func: any) => func.name === "claimFees"
        );
      });

      it("should contain claimFees function", () => {
        expect(claimFeesFunction).toBeDefined();
        expect(claimFeesFunction.type).toBe("function");
        expect(claimFeesFunction.name).toBe("claimFees");
      });

      it("should have correct stateMutability", () => {
        expect(claimFeesFunction.stateMutability).toBe("nonpayable");
      });

      it("should have tokens input", () => {
        const tokensInput = claimFeesFunction.inputs.find(
          (input: any) => input.name === "tokens"
        );
        expect(tokensInput).toBeDefined();
        expect(tokensInput.type).toBe("address[]");
      });

      it("should have correct number of inputs", () => {
        expect(claimFeesFunction.inputs).toHaveLength(1);
      });

      it("should have no outputs", () => {
        expect(claimFeesFunction.outputs).toHaveLength(0);
      });
    });

    it("should only contain the expected functions", () => {
      const functionNames = SETTLEMENT_ROUTER_ABI.map((func: any) => func.name);
      const expectedNames = ["settleAndExecute", "getPendingFees", "claimFees"];

      expect(functionNames.sort()).toEqual(expectedNames.sort());
    });

    it("should have all functions as function type", () => {
      SETTLEMENT_ROUTER_ABI.forEach((func: any) => {
        expect(func.type).toBe("function");
      });
    });

    it("should have valid structure for each function", () => {
      SETTLEMENT_ROUTER_ABI.forEach((func: any) => {
        expect(func).toHaveProperty("type");
        expect(func).toHaveProperty("name");
        expect(func).toHaveProperty("inputs");
        expect(func).toHaveProperty("outputs");
        expect(func).toHaveProperty("stateMutability");

        expect(Array.isArray(func.inputs)).toBe(true);
        expect(Array.isArray(func.outputs)).toBe(true);
      });
    });

    it("should have valid input structures", () => {
      SETTLEMENT_ROUTER_ABI.forEach((func: any) => {
        func.inputs.forEach((input: any) => {
          expect(input).toHaveProperty("name");
          expect(input).toHaveProperty("type");
          expect(typeof input.name).toBe("string");
          expect(typeof input.type).toBe("string");
        });
      });
    });

    it("should have valid output structures", () => {
      SETTLEMENT_ROUTER_ABI.forEach((func: any) => {
        func.outputs.forEach((output: any) => {
          expect(output).toHaveProperty("type");
          expect(typeof output.type).toBe("string");
        });
      });
    });

    describe("ABI validation", () => {
      it("should match expected settleAndExecute signature", () => {
        const settleFunction = SETTLEMENT_ROUTER_ABI.find(
          (func: any) => func.name === "settleAndExecute"
        );

        const expectedSignature =
          "settleAndExecute(address,address,uint256,uint256,uint256,bytes32,bytes,bytes32,address,uint256,address,bytes)";

        // Generate signature from inputs
        const inputTypes = settleFunction.inputs
          .map((input: any) => input.type)
          .join(",");
        const actualSignature = `${settleFunction.name}(${inputTypes})`;

        expect(actualSignature).toBe(expectedSignature);
      });

      it("should match expected getPendingFees signature", () => {
        const getPendingFeesFunction = SETTLEMENT_ROUTER_ABI.find(
          (func: any) => func.name === "getPendingFees"
        );

        const expectedSignature = "getPendingFees(address,address)";

        // Generate signature from inputs
        const inputTypes = getPendingFeesFunction.inputs
          .map((input: any) => input.type)
          .join(",");
        const actualSignature = `${getPendingFeesFunction.name}(${inputTypes})`;

        expect(actualSignature).toBe(expectedSignature);
      });

      it("should match expected claimFees signature", () => {
        const claimFeesFunction = SETTLEMENT_ROUTER_ABI.find(
          (func: any) => func.name === "claimFees"
        );

        const expectedSignature = "claimFees(address[])";

        // Generate signature from inputs
        const inputTypes = claimFeesFunction.inputs
          .map((input: any) => input.type)
          .join(",");
        const actualSignature = `${claimFeesFunction.name}(${inputTypes})`;

        expect(actualSignature).toBe(expectedSignature);
      });
    });

    describe("ABI usage examples", () => {
      it("should be usable for function encoding simulation", () => {
        // This test simulates how the ABI would be used for encoding function calls
        const settleFunction = SETTLEMENT_ROUTER_ABI.find(
          (func: any) => func.name === "settleAndExecute"
        );

        // Verify we can extract necessary info for encoding
        expect(settleFunction.name).toBe("settleAndExecute");
        expect(settleFunction.inputs).toHaveLength(12);

        // Verify each input has necessary properties for encoding
        settleFunction.inputs.forEach((input: any) => {
          expect(input.name).toBeTruthy();
          expect(input.type).toBeTruthy();
        });
      });

      it("should support view vs nonpayable distinction", () => {
        const viewFunctions = SETTLEMENT_ROUTER_ABI.filter(
          (func: any) => func.stateMutability === "view"
        );
        const nonpayableFunctions = SETTLEMENT_ROUTER_ABI.filter(
          (func: any) => func.stateMutability === "nonpayable"
        );

        expect(viewFunctions).toHaveLength(1);
        expect(nonpayableFunctions).toHaveLength(2);

        expect(viewFunctions[0].name).toBe("getPendingFees");
        expect(
          nonpayableFunctions.map((f: any) => f.name).sort()
        ).toEqual(["claimFees", "settleAndExecute"]);
      });
    });
  });
});