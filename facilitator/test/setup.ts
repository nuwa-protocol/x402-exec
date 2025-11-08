/**
 * Vitest Setup File
 *
 * Global setup for all tests
 */

import { vi } from "vitest";

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.PORT = "3001";
process.env.EVM_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";
process.env.BASE_SEPOLIA_SETTLEMENT_ROUTER_ADDRESS = "0x32431D4511e061F1133520461B07eC42afF157D6";

// Mock pino logger to reduce noise in tests
vi.mock("pino", () => {
  const noop = () => {};
  const mockLogger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    fatal: noop,
    trace: noop,
    child: () => mockLogger,
  };
  return {
    default: () => mockLogger,
  };
});

// Mock telemetry module
vi.mock("../src/telemetry.js", () => {
  const noop = () => {};
  const mockLogger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    fatal: noop,
    trace: noop,
    child: () => mockLogger,
  };

  return {
    getLogger: () => mockLogger,
    initTelemetry: noop,
    shutdownTelemetry: vi.fn().mockResolvedValue(undefined),
    traced: vi.fn((name, fn, attrs) => fn()),
    recordMetric: noop,
    recordHistogram: noop,
  };
});

// Suppress console output in tests unless explicitly needed
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
