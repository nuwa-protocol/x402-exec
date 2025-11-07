/**
 * Rate Limiting Middleware Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import {
  createVerifyRateLimiter,
  createSettleRateLimiter,
} from "../../../src/middleware/rate-limit.js";
import type { RateLimitConfig } from "../../../src/config.js";

describe("Rate Limiting Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = {
      ip: "127.0.0.1",
      path: "/test",
      method: "POST",
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe("createVerifyRateLimiter", () => {
    it("should create a rate limiter with correct configuration", () => {
      const config: RateLimitConfig = {
        enabled: true,
        verifyMax: 100,
        settleMax: 20,
        windowMs: 60000,
      };

      const limiter = createVerifyRateLimiter(config);
      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe("function");
    });

    it("should return no-op middleware when disabled", () => {
      const config: RateLimitConfig = {
        enabled: false,
        verifyMax: 100,
        settleMax: 20,
        windowMs: 60000,
      };

      const limiter = createVerifyRateLimiter(config);
      limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("createSettleRateLimiter", () => {
    it("should create a rate limiter with correct configuration", () => {
      const config: RateLimitConfig = {
        enabled: true,
        verifyMax: 100,
        settleMax: 20,
        windowMs: 60000,
      };

      const limiter = createSettleRateLimiter(config);
      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe("function");
    });

    it("should return no-op middleware when disabled", () => {
      const config: RateLimitConfig = {
        enabled: false,
        verifyMax: 100,
        settleMax: 20,
        windowMs: 60000,
      };

      const limiter = createSettleRateLimiter(config);
      limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
