/**
 * Tests for hooks utilities
 */

import { describe, it, expect, vi } from "vitest";
import { TransferHook, NFTMintHook, RewardHook } from "./hooks";
import type { Split } from "./hooks/transfer";
import { checksumAddress } from "viem";

// Mock getNetworkConfig function
vi.mock("./networks", () => ({
  getNetworkConfig: vi.fn((network: string) => {
    if (network === "base-sepolia") {
      return {
        hooks: {
          transfer: "0x4DE234059C6CcC94B8fE1eb1BD24804794083569",
        },
        demoHooks: {
          nftMint: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45",
          randomNFT: "0x8ba1f109551bD432803012645Hac136c",
          reward: "0x9ba1f109551bD432803012645Hac136d",
          rewardToken: "0xaba1f109551bD432803012645Hac136e",
        },
      };
    } else if (network === "mainnet") {
      return {
        hooks: {
          transfer: "0x1A2b3c4D5e6F7a8B9c0D1e2F3a4B5c6D7E8F9a0B",
        },
        demoHooks: {
          nftMint: "0x2A3b4c5D6e7F8a9B0c1D2e3F4a5B6c7D8E9F0a1C",
          randomNFT: "0x3B4c5d6E7f8A9b0C1d2E3f4A5b6C7d8E9f0A1b2",
          reward: "0x4C5d6e7F8a9B0c1D2e3F4a5B6c7D8E9f0A1b2C3",
          rewardToken: "0x5D6e7F8a9b0C1d2E3f4A5b6C7d8E9f0A1b2C3D4",
        },
      };
    }
    throw new Error(`Network "${network}" not found`);
  }),
}));

describe("hooks", () => {
  const validAddress = checksumAddress("0x1234567890123456789012345678901234567890");

  describe("TransferHook", () => {
    describe("encode", () => {
      it("should return '0x' for simple transfer (no splits)", () => {
        const result = TransferHook.encode();
        expect(result).toBe("0x");
      });

      it("should return '0x' for empty splits array", () => {
        const result = TransferHook.encode([]);
        expect(result).toBe("0x");
      });

      it("should encode single split correctly", () => {
        const splits: Split[] = [
          {
            recipient: validAddress,
            bips: 10000, // 100%
          },
        ];

        const result = TransferHook.encode(splits);

        expect(result).toMatch(/^0x[0-9a-f]+$/); // Should be ABI encoded
        expect(result).not.toBe("0x");
        expect(result.length).toBeGreaterThan(64); // Should be longer than just a hash
      });

      it("should encode multiple splits correctly", () => {
        const splits: Split[] = [
          {
            recipient: checksumAddress("0x1234567890123456789012345678901234567890"),
            bips: 6000, // 60%
          },
          {
            recipient: checksumAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
            bips: 4000, // 40%
          },
        ];

        const result = TransferHook.encode(splits);

        expect(result).toMatch(/^0x[0-9a-f]+$/);
        expect(result).not.toBe("0x");
      });

      it("should encode partial splits correctly", () => {
        const splits: Split[] = [
          {
            recipient: validAddress,
            bips: 3000, // 30%
          },
        ];

        const result = TransferHook.encode(splits);

        expect(result).toMatch(/^0x[0-9a-f]+$/);
        expect(result).not.toBe("0x");
      });

      it("should throw error for invalid recipient address (empty string)", () => {
        const splits: Split[] = [
          {
            recipient: "",
            bips: 1000,
          },
        ];

        expect(() => {
          TransferHook.encode(splits);
        }).toThrow("Invalid recipient address: ");
      });

      it("should throw error for zero address", () => {
        const splits: Split[] = [
          {
            recipient: "0x0000000000000000000000000000000000000000",
            bips: 1000,
          },
        ];

        expect(() => {
          TransferHook.encode(splits);
        }).toThrow("Invalid recipient address: 0x0000000000000000000000000000000000000000");
      });

      it("should throw error for zero bips", () => {
        const splits: Split[] = [
          {
            recipient: validAddress,
            bips: 0,
          },
        ];

        expect(() => {
          TransferHook.encode(splits);
        }).toThrow("Bips must be greater than 0, got: 0");
      });

      it("should throw error for negative bips", () => {
        const splits: Split[] = [
          {
            recipient: validAddress,
            bips: -100,
          },
        ];

        expect(() => {
          TransferHook.encode(splits);
        }).toThrow("Bips must be greater than 0, got: -100");
      });

      it("should throw error for bips exceeding 10000", () => {
        const splits: Split[] = [
          {
            recipient: validAddress,
            bips: 10001,
          },
        ];

        expect(() => {
          TransferHook.encode(splits);
        }).toThrow("Individual bips cannot exceed 10000, got: 10001");
      });

      it("should throw error for total bips exceeding 10000", () => {
        const splits: Split[] = [
          {
            recipient: validAddress,
            bips: 6000,
          },
          {
            recipient: checksumAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
            bips: 5000, // Total = 11000 > 10000
          },
        ];

        expect(() => {
          TransferHook.encode(splits);
        }).toThrow("Total bips (11000) exceeds 10000 (100%)");
      });

      it("should accept total bips equal to 10000", () => {
        const splits: Split[] = [
          {
            recipient: validAddress,
            bips: 7000,
          },
          {
            recipient: checksumAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
            bips: 3000, // Total = 10000
          },
        ];

        expect(() => {
          const result = TransferHook.encode(splits);
          expect(result).toMatch(/^0x[0-9a-f]+$/);
        }).not.toThrow();
      });

      it("should accept total bips less than 10000", () => {
        const splits: Split[] = [
          {
            recipient: validAddress,
            bips: 2000,
          },
          {
            recipient: checksumAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
            bips: 1000, // Total = 3000 < 10000
          },
        ];

        expect(() => {
          const result = TransferHook.encode(splits);
          expect(result).toMatch(/^0x[0-9a-f]+$/);
        }).not.toThrow();
      });

      it("should handle mixed case recipient addresses", () => {
        const splits: Split[] = [
          {
            recipient: checksumAddress("0xAbCdEf1234567890123456789012345678901234"),
            bips: 5000,
          },
        ];

        expect(() => {
          const result = TransferHook.encode(splits);
          expect(result).toMatch(/^0x[0-9a-f]+$/);
        }).not.toThrow();
      });

      it("should handle single bips correctly", () => {
        const splits: Split[] = [
          {
            recipient: validAddress,
            bips: 1, // 0.01%
          },
        ];

        expect(() => {
          const result = TransferHook.encode(splits);
          expect(result).toMatch(/^0x[0-9a-f]+$/);
        }).not.toThrow();
      });

      it("should produce consistent encoding for same splits", () => {
        const splits: Split[] = [
          {
            recipient: validAddress,
            bips: 6000,
          },
          {
            recipient: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            bips: 4000,
          },
        ];

        const result1 = TransferHook.encode(splits);
        const result2 = TransferHook.encode(splits);

        expect(result1).toBe(result2);
      });

      it("should produce different encodings for different splits", () => {
        const splits1: Split[] = [
          {
            recipient: validAddress,
            bips: 5000,
          },
        ];

        const splits2: Split[] = [
          {
            recipient: validAddress,
            bips: 6000,
          },
        ];

        const result1 = TransferHook.encode(splits1);
        const result2 = TransferHook.encode(splits2);

        expect(result1).not.toBe(result2);
      });
    });

    describe("getAddress", () => {
      it("should return TransferHook address for supported network", () => {
        const address = TransferHook.getAddress("base-sepolia");
        expect(address).toBe("0x4DE234059C6CcC94B8fE1eb1BD24804794083569");
      });

      it("should return different addresses for different networks", () => {
        const address1 = TransferHook.getAddress("base-sepolia");
        const address2 = TransferHook.getAddress("mainnet");

        expect(address1).not.toBe(address2);
        expect(address1).toBe("0x4DE234059C6CcC94B8fE1eb1BD24804794083569");
        expect(address2).toBe("0x1A2b3c4D5e6F7a8B9c0D1e2F3a4B5c6D7E8F9a0B");
      });

      it("should throw error for unsupported network", () => {
        expect(() => {
          TransferHook.getAddress("unsupported-network");
        }).toThrow('Network "unsupported-network" not found');
      });
    });
  });

  describe("NFTMintHook", () => {
    describe("getAddress", () => {
      it("should return NFTMintHook address for supported network", () => {
        const address = NFTMintHook.getAddress("base-sepolia");
        expect(address).toBe("0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45");
      });

      it("should return different addresses for different networks", () => {
        const address1 = NFTMintHook.getAddress("base-sepolia");
        const address2 = NFTMintHook.getAddress("mainnet");

        expect(address1).not.toBe(address2);
        expect(address1).toBe("0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45");
        expect(address2).toBe("0x2A3b4c5D6e7F8a9B0c1D2e3F4a5B6c7D8E9F0a1C");
      });

      it("should throw error for network without demo hooks", () => {
        expect(() => {
          NFTMintHook.getAddress("unsupported-network");
        }).toThrow('Network "unsupported-network" not found');
      });
    });

    describe("getNFTContractAddress", () => {
      it("should return NFT contract address for supported network", () => {
        const address = NFTMintHook.getNFTContractAddress("base-sepolia");
        expect(address).toBe("0x8ba1f109551bD432803012645Hac136c");
      });

      it("should return different addresses for different networks", () => {
        const address1 = NFTMintHook.getNFTContractAddress("base-sepolia");
        const address2 = NFTMintHook.getNFTContractAddress("mainnet");

        expect(address1).not.toBe(address2);
        expect(address1).toBe("0x8ba1f109551bD432803012645Hac136c");
        expect(address2).toBe("0x3B4c5d6E7f8A9b0C1d2E3f4A5b6C7d8E9f0A1b2");
      });

      it("should throw error for network without demo hooks", () => {
        expect(() => {
          NFTMintHook.getNFTContractAddress("unsupported-network");
        }).toThrow('Network "unsupported-network" not found');
      });
    });

    describe("encode", () => {
      it("should encode mint config correctly", () => {
        const config = {
          nftContract: validAddress,
        };

        const result = NFTMintHook.encode(config);

        expect(result).toMatch(/^0x[0-9a-f]+$/);
        expect(result).not.toBe("0x");
      });

      it("should encode different addresses to different results", () => {
        const config1 = {
          nftContract: checksumAddress("0x1234567890123456789012345678901234567890"),
        };

        const config2 = {
          nftContract: checksumAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
        };

        const result1 = NFTMintHook.encode(config1);
        const result2 = NFTMintHook.encode(config2);

        expect(result1).not.toBe(result2);
      });

      it("should produce consistent encoding for same config", () => {
        const config = {
          nftContract: validAddress,
        };

        const result1 = NFTMintHook.encode(config);
        const result2 = NFTMintHook.encode(config);

        expect(result1).toBe(result2);
      });

      it("should handle mixed case addresses", () => {
        const config = {
          nftContract: checksumAddress("0xAbCdEf1234567890123456789012345678901234"),
        };

        expect(() => {
          const result = NFTMintHook.encode(config);
          expect(result).toMatch(/^0x[0-9a-f]+$/);
        }).not.toThrow();
      });
    });
  });

  describe("RewardHook", () => {
    describe("getAddress", () => {
      it("should return RewardHook address for supported network", () => {
        const address = RewardHook.getAddress("base-sepolia");
        expect(address).toBe("0x9ba1f109551bD432803012645Hac136d");
      });

      it("should return different addresses for different networks", () => {
        const address1 = RewardHook.getAddress("base-sepolia");
        const address2 = RewardHook.getAddress("mainnet");

        expect(address1).not.toBe(address2);
        expect(address1).toBe("0x9ba1f109551bD432803012645Hac136d");
        expect(address2).toBe("0x4C5d6e7F8a9B0c1D2e3F4a5B6c7D8E9f0A1b2C3");
      });

      it("should throw error for network without demo hooks", () => {
        expect(() => {
          RewardHook.getAddress("unsupported-network");
        }).toThrow('Network "unsupported-network" not found');
      });
    });

    describe("getTokenAddress", () => {
      it("should return reward token address for supported network", () => {
        const address = RewardHook.getTokenAddress("base-sepolia");
        expect(address).toBe("0xaba1f109551bD432803012645Hac136e");
      });

      it("should return different addresses for different networks", () => {
        const address1 = RewardHook.getTokenAddress("base-sepolia");
        const address2 = RewardHook.getTokenAddress("mainnet");

        expect(address1).not.toBe(address2);
        expect(address1).toBe("0xaba1f109551bD432803012645Hac136e");
        expect(address2).toBe("0x5D6e7F8a9b0C1d2E3f4A5b6C7d8E9f0A1b2C3D4");
      });

      it("should throw error for network without demo hooks", () => {
        expect(() => {
          RewardHook.getTokenAddress("unsupported-network");
        }).toThrow('Network "unsupported-network" not found');
      });
    });

    describe("encode", () => {
      it("should encode reward config correctly", () => {
        const config = {
          rewardToken: validAddress,
        };

        const result = RewardHook.encode(config);

        expect(result).toMatch(/^0x[0-9a-f]+$/);
        expect(result).not.toBe("0x");
      });

      it("should encode different addresses to different results", () => {
        const config1 = {
          rewardToken: checksumAddress("0x1234567890123456789012345678901234567890"),
        };

        const config2 = {
          rewardToken: checksumAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
        };

        const result1 = RewardHook.encode(config1);
        const result2 = RewardHook.encode(config2);

        expect(result1).not.toBe(result2);
      });

      it("should produce consistent encoding for same config", () => {
        const config = {
          rewardToken: validAddress,
        };

        const result1 = RewardHook.encode(config);
        const result2 = RewardHook.encode(config);

        expect(result1).toBe(result2);
      });

      it("should handle mixed case addresses", () => {
        const config = {
          rewardToken: checksumAddress("0xAbCdEf1234567890123456789012345678901234"),
        };

        expect(() => {
          const result = RewardHook.encode(config);
          expect(result).toMatch(/^0x[0-9a-f]+$/);
        }).not.toThrow();
      });
    });
  });

  describe("integration tests", () => {
    it("should work with TransferHook simple transfer scenario", () => {
      const hookData = TransferHook.encode(); // Simple transfer
      const address = TransferHook.getAddress("base-sepolia");

      expect(hookData).toBe("0x");
      expect(address).toBe("0x4DE234059C6CcC94B8fE1eb1BD24804794083569");
    });

    it("should work with TransferHook distributed transfer scenario", () => {
      const splits: Split[] = [
        {
          recipient: checksumAddress("0x1234567890123456789012345678901234567890"),
          bips: 7000, // 70%
        },
        {
          recipient: checksumAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
          bips: 3000, // 30%
        },
      ];

      const hookData = TransferHook.encode(splits);
      const address = TransferHook.getAddress("base-sepolia");

      expect(hookData).toMatch(/^0x[0-9a-f]+$/);
      expect(address).toBe("0x4DE234059C6CcC94B8fE1eb1BD24804794083569");
    });

    it("should work with NFTMintHook complete scenario", () => {
      const config = {
        nftContract: checksumAddress("0x1234567890123456789012345678901234567890"),
      };

      const hookData = NFTMintHook.encode(config);
      const address = NFTMintHook.getAddress("base-sepolia");
      const nftContract = NFTMintHook.getNFTContractAddress("base-sepolia");

      expect(hookData).toMatch(/^0x[0-9a-f]+$/);
      expect(address).toBe("0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45");
      expect(nftContract).toBe("0x8ba1f109551bD432803012645Hac136c");
    });

    it("should work with RewardHook complete scenario", () => {
      const config = {
        rewardToken: checksumAddress("0x1234567890123456789012345678901234567890"),
      };

      const hookData = RewardHook.encode(config);
      const address = RewardHook.getAddress("base-sepolia");
      const tokenAddress = RewardHook.getTokenAddress("base-sepolia");

      expect(hookData).toMatch(/^0x[0-9a-f]+$/);
      expect(address).toBe("0x9ba1f109551bD432803012645Hac136d");
      expect(tokenAddress).toBe("0xaba1f109551bD432803012645Hac136e");
    });
  });
});