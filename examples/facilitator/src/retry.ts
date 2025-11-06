/**
 * Retry Mechanism with Exponential Backoff
 * 
 * This module provides utilities for retrying operations with exponential backoff,
 * with special handling for blockchain/RPC operations.
 */

import { getLogger } from "./telemetry.js";
import { shouldRetry, FacilitatorError } from "./errors.js";

const logger = getLogger();

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  
  /** Backoff multiplier */
  backoffMultiplier: number;
  
  /** Add random jitter to prevent thundering herd */
  jitter: boolean;
  
  /** Timeout per attempt in milliseconds */
  timeoutMs?: number;
  
  /** Custom retry predicate (return true to retry) */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * RPC-specific retry configuration (more aggressive)
 */
export const RPC_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  initialDelayMs: 500, // 0.5 seconds
  maxDelayMs: 10000, // 10 seconds
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Transaction confirmation retry configuration (more patient)
 */
export const TX_CONFIRM_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 60, // 60 attempts
  initialDelayMs: 2000, // 2 seconds
  maxDelayMs: 5000, // 5 seconds
  backoffMultiplier: 1.1, // Slow growth
  jitter: false,
  timeoutMs: 120000, // 2 minutes total timeout
};

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  let delay = Math.min(exponentialDelay, config.maxDelayMs);
  
  if (config.jitter) {
    // Add ±25% jitter
    const jitterFactor = 0.75 + Math.random() * 0.5;
    delay *= jitterFactor;
  }
  
  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry context for tracking state across attempts
 */
export interface RetryContext {
  attempt: number;
  totalElapsed: number;
  lastError?: unknown;
}

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: (context: RetryContext) => Promise<T>,
  config: Partial<RetryConfig> = {},
  operationName = "operation"
): Promise<T> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  
  let lastError: unknown;
  const context: RetryContext = {
    attempt: 0,
    totalElapsed: 0,
  };

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    context.attempt = attempt;
    context.totalElapsed = Date.now() - startTime;
    
    // Check global timeout
    if (finalConfig.timeoutMs && context.totalElapsed >= finalConfig.timeoutMs) {
      logger.warn({
        operation: operationName,
        attempt,
        totalElapsed: context.totalElapsed,
        timeout: finalConfig.timeoutMs,
      }, "Retry timeout exceeded");
      break;
    }

    try {
      logger.debug({
        operation: operationName,
        attempt,
        maxAttempts: finalConfig.maxAttempts,
      }, "Attempting operation");

      const result = await fn(context);
      
      if (attempt > 1) {
        logger.info({
          operation: operationName,
          attempt,
          totalElapsed: context.totalElapsed,
        }, "Operation succeeded after retry");
      }
      
      return result;
    } catch (error) {
      lastError = error;
      context.lastError = error;

      const isLastAttempt = attempt >= finalConfig.maxAttempts;
      const willRetry = !isLastAttempt && (
        finalConfig.shouldRetry 
          ? finalConfig.shouldRetry(error, attempt)
          : shouldRetry(error)
      );

      if (error instanceof FacilitatorError) {
        error.log();
      } else {
        logger.error({
          error,
          operation: operationName,
          attempt,
        }, "Operation failed");
      }

      if (!willRetry) {
        if (isLastAttempt) {
          logger.error({
            operation: operationName,
            totalAttempts: attempt,
            totalElapsed: context.totalElapsed,
          }, "Max retry attempts reached");
        } else {
          logger.warn({
            operation: operationName,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          }, "Error not recoverable, aborting retries");
        }
        break;
      }

      const delay = calculateDelay(attempt, finalConfig);
      logger.info({
        operation: operationName,
        attempt,
        nextAttempt: attempt + 1,
        delay,
        error: error instanceof Error ? error.message : String(error),
      }, "Retrying operation after delay");

      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Wrap an async function with retry logic
 */
export function retryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: Partial<RetryConfig> = {},
  operationName?: string
): T {
  const wrappedFn = async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return withRetry(
      async () => fn(...args),
      config,
      operationName || fn.name || "anonymous"
    );
  };
  
  return wrappedFn as T;
}

/**
 * Retry decorator for class methods
 */
export function Retry(config: Partial<RetryConfig> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(
        async () => originalMethod.apply(this, args),
        config,
        `${target.constructor.name}.${propertyKey}`
      );
    };

    return descriptor;
  };
}

/**
 * Utility: Retry RPC call with appropriate config
 */
export async function retryRpcCall<T>(
  fn: () => Promise<T>,
  operationName = "RPC call"
): Promise<T> {
  return withRetry(
    async () => fn(),
    RPC_RETRY_CONFIG,
    operationName
  );
}

/**
 * Utility: Retry transaction confirmation with appropriate config
 */
export async function retryTxConfirmation<T>(
  fn: () => Promise<T>,
  operationName = "Transaction confirmation"
): Promise<T> {
  return withRetry(
    async () => fn(),
    TX_CONFIRM_RETRY_CONFIG,
    operationName
  );
}

