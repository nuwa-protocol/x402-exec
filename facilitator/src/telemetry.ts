/**
 * Telemetry Module - OpenTelemetry and Structured Logging
 *
 * This module provides:
 * - Structured logging using Pino
 * - OpenTelemetry tracing
 * - OpenTelemetry metrics
 * - Configuration based on environment variables
 *
 * Based on deps/x402-rs/src/telemetry.rs implementation
 */

import pino from "pino";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { trace, metrics, Tracer, Meter, SpanStatusCode, context } from "@opentelemetry/api";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";

/**
 * Telemetry protocol type
 */
type TelemetryProtocol = "http/protobuf" | "grpc";

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  serviceName?: string;
  serviceVersion?: string;
  deployment?: string;
  otlpEndpoint?: string;
  otlpHeaders?: Record<string, string>;
  otlpProtocol?: TelemetryProtocol;
}

/**
 * Detect telemetry configuration from environment variables
 */
function detectTelemetryFromEnv(): TelemetryConfig | null {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const otlpHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS;
  const otlpProtocol = process.env.OTEL_EXPORTER_OTLP_PROTOCOL;

  // Check if telemetry is enabled
  if (!otlpEndpoint && !otlpHeaders && !otlpProtocol) {
    return null;
  }

  // Parse headers - support values containing '=' (e.g., base64 tokens)
  let headers: Record<string, string> = {};
  if (otlpHeaders) {
    // Support both comma and semicolon separators
    const pairs = otlpHeaders.split(/[,;]/);
    for (const pair of pairs) {
      const equalIndex = pair.indexOf("=");
      if (equalIndex > 0) {
        const key = pair.substring(0, equalIndex).trim();
        const value = pair.substring(equalIndex + 1).trim();
        // Ensure both key and value are non-empty after trimming
        if (key.length > 0 && value.length > 0) {
          headers[key] = value;
        }
      }
    }
  }

  return {
    serviceName: process.env.OTEL_SERVICE_NAME || "x402-facilitator",
    serviceVersion: process.env.OTEL_SERVICE_VERSION || "0.1.0",
    deployment: process.env.OTEL_SERVICE_DEPLOYMENT || process.env.NODE_ENV || "development",
    otlpEndpoint: otlpEndpoint || "http://localhost:4318",
    otlpHeaders: headers,
    otlpProtocol: (otlpProtocol as TelemetryProtocol) || "http/protobuf",
  };
}

/**
 * Global logger instance
 */
let logger: pino.Logger | null = null;

/**
 * Global OpenTelemetry SDK instance
 */
let otelSDK: NodeSDK | null = null;

/**
 * Global tracer instance
 */
let tracer: Tracer;

/**
 * Global meter instance
 */
let meter: Meter;

/**
 * Flag to track if first metric has been recorded
 */
let firstMetricRecorded = false;

/**
 * Initialize telemetry system
 *
 * @param config
 */
export function initTelemetry(config?: Partial<TelemetryConfig>): void {
  // Detect configuration from environment
  const envConfig = detectTelemetryFromEnv();
  const finalConfig = { ...envConfig, ...config };

  // Initialize logger
  logger = pino({
    name: finalConfig.serviceName || "x402-facilitator",
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    base: {
      service: finalConfig.serviceName,
      version: finalConfig.serviceVersion,
      environment: finalConfig.deployment,
    },
  });

  // Initialize OpenTelemetry if configured
  if (envConfig) {
    try {
      // Create resource
      const resource = new Resource({
        [SEMRESATTRS_SERVICE_NAME]: finalConfig.serviceName!,
        [SEMRESATTRS_SERVICE_VERSION]: finalConfig.serviceVersion!,
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: finalConfig.deployment!,
      });

      // Create trace exporter
      const traceExporter = new OTLPTraceExporter({
        url: `${finalConfig.otlpEndpoint}/v1/traces`,
        headers: finalConfig.otlpHeaders,
      });

      // Create metric exporter and reader
      const metricExporter = new OTLPMetricExporter({
        url: `${finalConfig.otlpEndpoint}/v1/metrics`,
        headers: finalConfig.otlpHeaders,
      });

      const metricReader = new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 30000, // 30 seconds
        exportTimeoutMillis: 10000, // 10 seconds timeout
      });

      // Initialize SDK with both trace and metrics
      // Use 'as any' to work around type incompatibility between versions
      otelSDK = new NodeSDK({
        resource,
        traceExporter,
        metricReader: metricReader as any,
        instrumentations: [
          new HttpInstrumentation({
            ignoreIncomingRequestHook: (req) => {
              // Ignore health check requests
              return req.url === "/health" || req.url === "/ready";
            },
          }),
          new ExpressInstrumentation(),
        ],
      });

      otelSDK.start();

      logger.info(
        {
          protocol: finalConfig.otlpProtocol,
          endpoint: finalConfig.otlpEndpoint,
          headerKeys: Object.keys(finalConfig.otlpHeaders || {}),
          hasAuthHeader: !!finalConfig.otlpHeaders?.Authorization,
          authType: finalConfig.otlpHeaders?.Authorization?.split(" ")[0] || "none",
          serviceName: finalConfig.serviceName,
          deployment: finalConfig.deployment,
        },
        "OpenTelemetry tracing and metrics exporter is enabled",
      );

      // Add configuration warnings
      if (!finalConfig.otlpHeaders?.Authorization) {
        logger.warn("No Authorization header configured - metrics export may fail");
      }

      if (!finalConfig.otlpEndpoint?.startsWith("https://")) {
        logger.warn({ endpoint: finalConfig.otlpEndpoint }, "Using non-HTTPS endpoint");
      }
    } catch (error) {
      logger.error({ error }, "Failed to initialize OpenTelemetry");
    }
  } else {
    logger.info("OpenTelemetry is not enabled");
  }

  // Get tracer and meter
  tracer = trace.getTracer(
    finalConfig.serviceName || "x402-facilitator",
    finalConfig.serviceVersion || "0.1.0",
  );
  meter = metrics.getMeter(
    finalConfig.serviceName || "x402-facilitator",
    finalConfig.serviceVersion || "0.1.0",
  );

  logger.info("Telemetry system initialized");
}

/**
 * Get logger instance
 *
 * Returns a fallback logger if not initialized (before initTelemetry() is called).
 * The fallback logger uses console methods but maintains pino-compatible interface.
 */
export function getLogger(): pino.Logger {
  if (!logger) {
    // Return a fallback logger that uses console
    // This allows modules to safely call getLogger() at load time
    return {
      info: (...args: any[]) => console.log(...args),
      warn: (...args: any[]) => console.warn(...args),
      error: (...args: any[]) => console.error(...args),
      debug: (...args: any[]) => console.debug(...args),
      trace: (...args: any[]) => console.trace(...args),
      fatal: (...args: any[]) => console.error("[FATAL]", ...args),
      child: () => getLogger(), // Return self for child loggers
    } as any as pino.Logger;
  }
  return logger;
}

/**
 * Get tracer instance
 */
export function getTracer(): Tracer {
  if (!tracer) {
    throw new Error("Tracer not initialized. Call initTelemetry() first.");
  }
  return tracer;
}

/**
 * Get meter instance
 */
export function getMeter(): Meter {
  if (!meter) {
    throw new Error("Meter not initialized. Call initTelemetry() first.");
  }
  return meter;
}

/**
 * Shutdown telemetry system gracefully
 */
export async function shutdownTelemetry(): Promise<void> {
  const currentLogger = getLogger(); // Use getLogger() to handle null case
  if (otelSDK) {
    try {
      await otelSDK.shutdown();
      currentLogger.info("OpenTelemetry SDK shut down successfully");
    } catch (error) {
      currentLogger.error({ error }, "Error shutting down OpenTelemetry SDK");
    }
  }
}

/**
 * Create a child logger with additional context
 *
 * @param bindings
 */
export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return getLogger().child(bindings);
}

/**
 * Trace a function execution
 *
 * @param spanName
 * @param fn
 * @param attributes
 */
export async function traced<T>(
  spanName: string,
  fn: (span: any) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const span = getTracer().startSpan(spanName, {
    attributes,
  });

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Helper to record metric
 *
 * @param name
 * @param value
 * @param attributes
 */
export function recordMetric(
  name: string,
  value: number,
  attributes?: Record<string, string | number | boolean>,
): void {
  try {
    const counter = getMeter().createCounter(name);
    counter.add(value, attributes);

    // Log first metric record to confirm metrics collection is active
    if (!firstMetricRecorded) {
      firstMetricRecorded = true;
      if (logger) {
        logger.info({ name, value }, "First metric recorded - metrics collection is active");
      }
    }
  } catch (error) {
    // Silently fail to avoid affecting business logic
    // Only log at debug level to avoid log pollution
    if (logger) {
      logger.debug({ error, name, value }, "Failed to record metric");
    }
  }
}

/**
 * Helper to record histogram metric
 *
 * @param name
 * @param value
 * @param attributes
 */
export function recordHistogram(
  name: string,
  value: number,
  attributes?: Record<string, string | number | boolean>,
): void {
  try {
    const histogram = getMeter().createHistogram(name);
    histogram.record(value, attributes);

    // Log first metric record to confirm metrics collection is active
    if (!firstMetricRecorded) {
      firstMetricRecorded = true;
      if (logger) {
        logger.info({ name, value }, "First metric recorded - metrics collection is active");
      }
    }
  } catch (error) {
    // Silently fail to avoid affecting business logic
    // Only log at debug level to avoid log pollution
    if (logger) {
      logger.debug({ error, name, value }, "Failed to record histogram");
    }
  }
}
