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
import { trace, metrics, Tracer, Meter, SpanStatusCode, context, propagation } from "@opentelemetry/api";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";

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

  // Parse headers
  let headers: Record<string, string> = {};
  if (otlpHeaders) {
    headers = otlpHeaders.split(",").reduce((acc, pair) => {
      const [key, value] = pair.split("=");
      if (key && value) {
        acc[key.trim()] = value.trim();
      }
      return acc;
    }, {} as Record<string, string>);
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
let logger: pino.Logger;

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
 * Initialize telemetry system
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

      // Create metric reader
      const metricReader = new PeriodicExportingMetricReader({
        exporter: new (require("@opentelemetry/exporter-metrics-otlp-http").OTLPMetricExporter)({
          url: `${finalConfig.otlpEndpoint}/v1/metrics`,
          headers: finalConfig.otlpHeaders,
        }),
        exportIntervalMillis: 30000, // 30 seconds
      });

      // Initialize SDK
      otelSDK = new NodeSDK({
        resource,
        traceExporter,
        metricReader,
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
        },
        "OpenTelemetry tracing and metrics exporter is enabled"
      );
    } catch (error) {
      logger.error({ error }, "Failed to initialize OpenTelemetry");
    }
  } else {
    logger.info("OpenTelemetry is not enabled");
  }

  // Get tracer and meter
  tracer = trace.getTracer(finalConfig.serviceName || "x402-facilitator", finalConfig.serviceVersion || "0.1.0");
  meter = metrics.getMeter(finalConfig.serviceName || "x402-facilitator", finalConfig.serviceVersion || "0.1.0");

  logger.info("Telemetry system initialized");
}

/**
 * Get logger instance
 */
export function getLogger(): pino.Logger {
  if (!logger) {
    throw new Error("Logger not initialized. Call initTelemetry() first.");
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
  if (otelSDK) {
    try {
      await otelSDK.shutdown();
      logger.info("OpenTelemetry SDK shut down successfully");
    } catch (error) {
      logger.error({ error }, "Error shutting down OpenTelemetry SDK");
    }
  }
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return getLogger().child(bindings);
}

/**
 * Trace a function execution
 */
export async function traced<T>(
  spanName: string,
  fn: (span: any) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
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
 */
export function recordMetric(
  name: string,
  value: number,
  attributes?: Record<string, string | number | boolean>
): void {
  const counter = getMeter().createCounter(name);
  counter.add(value, attributes);
}

/**
 * Helper to record histogram metric
 */
export function recordHistogram(
  name: string,
  value: number,
  attributes?: Record<string, string | number | boolean>
): void {
  const histogram = getMeter().createHistogram(name);
  histogram.record(value, attributes);
}

