import pino from 'pino';

/**
 * Create logger instance with configuration
 */
const logger = pino({
  level: 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export { logger };

/**
 * Create child logger with context
 */
export function createLogger(context: string) {
  return logger.child({ context });
}

/**
 * Log error with stack trace
 */
export function logError(error: unknown, context?: string) {
  const contextLogger = context ? createLogger(context) : logger;
  
  if (error instanceof Error) {
    contextLogger.error({
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
  } else {
    contextLogger.error({ error: String(error) });
  }
}

/**
 * Log API request
 */
export function logRequest(method: string, path: string, duration?: number) {
  logger.info({
    type: 'request',
    method,
    path,
    duration: duration ? `${duration}ms` : undefined,
  });
}

/**
 * Log indexer progress
 */
export function logIndexerProgress(
  network: string,
  processed: number,
  total: number,
  duration?: number
) {
  logger.info({
    type: 'indexer',
    network,
    processed,
    total,
    progress: `${((processed / total) * 100).toFixed(2)}%`,
    duration: duration ? `${duration}ms` : undefined,
  });
}

