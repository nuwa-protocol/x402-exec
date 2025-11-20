/**
 * Error handling utilities
 */

/**
 * Base error class for application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

/**
 * External API error (502)
 */
export class ExternalApiError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'EXTERNAL_API_ERROR', 502, details);
    this.name = 'ExternalApiError';
  }
}

/**
 * Explorer API error (502)
 */
export class ExplorerApiError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'EXPLORER_API_ERROR', 502, details);
    this.name = 'ExplorerApiError';
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', details?: unknown) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
    this.name = 'RateLimitError';
  }
}

/**
 * Configuration error (500)
 */
export class ConfigError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', 500, details);
    this.name = 'ConfigError';
  }
}

/**
 * Check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 'INTERNAL_ERROR', 500, {
      originalError: error.name,
      stack: error.stack,
    });
  }

  return new AppError(
    'An unknown error occurred',
    'UNKNOWN_ERROR',
    500,
    { error: String(error) }
  );
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: unknown) {
  const appError = toAppError(error);
  
  return {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details && typeof appError.details === 'object' ? { details: appError.details } : {}),
    },
  };
}

