/**
 * Middleware utility functions for x402x v2 packages
 * 
 * These utilities provide helpers for route matching, JSON encoding,
 * and other common middleware operations.
 */

/**
 * Route configuration for payment requirements
 */
export interface RouteConfig {
  price: string | number;
  network?: string;
  extra?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

/**
 * Routes configuration - mapping of route patterns to configs
 */
export type RoutesConfig = Record<string, RouteConfig | string | number>;

/**
 * Compiled route pattern with regex
 */
export interface RoutePattern {
  verb: string;
  pattern: RegExp;
  config: RouteConfig;
}

/**
 * Compute route patterns from routes config
 * 
 * Converts route configuration into compiled patterns with regex matching.
 * 
 * @param routes - Routes configuration
 * @returns Array of route patterns
 * 
 * @example
 * ```typescript
 * const routes = {
 *   'GET /api/data': { price: '0.01', network: 'base-sepolia' },
 *   '/public/*': '0'
 * };
 * const patterns = computeRoutePatterns(routes);
 * ```
 */
export function computeRoutePatterns(routes: RoutesConfig): RoutePattern[] {
  const normalizedRoutes = Object.fromEntries(
    Object.entries(routes).map(([pattern, value]) => [
      pattern,
      typeof value === "string" || typeof value === "number"
        ? ({ price: value, network: "base-sepolia" } as RouteConfig)
        : (value as RouteConfig),
    ]),
  );

  return Object.entries(normalizedRoutes).map(([pattern, routeConfig]) => {
    // Split pattern into verb and path, defaulting to "*" for verb if not specified
    const [verb, path] = pattern.includes(" ") ? pattern.split(/\s+/) : ["*", pattern];
    if (!path) {
      throw new Error(`Invalid route pattern: ${pattern}`);
    }
    return {
      verb: verb.toUpperCase(),
      pattern: new RegExp(
        `^${
          path
            // First escape backslashes to prevent regex injection
            .replace(/\\/g, "\\\\")
            // Then escape all special regex characters except * and []
            .replace(/[$()+.?^{|}]/g, "\\$&")
            // Then handle our special pattern characters
            .replace(/\*/g, ".*?") // Make wildcard non-greedy
            .replace(/\[([^\]]+)\]/g, "[^/]+") // Convert [param] to regex capture
            .replace(/\//g, "\\/") // Escape slashes
        }$`,
        "i",
      ),
      config: routeConfig,
    };
  });
}

/**
 * Find matching route for given path and method
 * 
 * @param routePatterns - Compiled route patterns
 * @param path - Request path
 * @param method - HTTP method
 * @returns Matching route pattern or undefined
 * 
 * @example
 * ```typescript
 * const route = findMatchingRoute(patterns, '/api/data', 'GET');
 * ```
 */
export function findMatchingRoute(
  routePatterns: RoutePattern[],
  path: string,
  method: string,
): RoutePattern | undefined {
  // Normalize the path
  let normalizedPath: string;
  try {
    // First split off query parameters and hash fragments
    const pathWithoutQuery = path.split(/[?#]/)[0];

    // Then decode the path
    const decodedPath = decodeURIComponent(pathWithoutQuery);

    // Normalize the path (just clean up slashes)
    normalizedPath = decodedPath
      .replace(/\\/g, "/") // replace backslashes
      .replace(/\/+/g, "/") // collapse slashes
      .replace(/(.+?)\/+$/, "$1"); // trim trailing slashes
  } catch {
    // If decoding fails, return undefined
    return undefined;
  }

  // Find matching route pattern
  const matchingRoutes = routePatterns.filter(({ pattern, verb }) => {
    const matchesPath = pattern.test(normalizedPath);
    const upperMethod = method.toUpperCase();
    const matchesVerb = verb === "*" || upperMethod === verb;
    return matchesPath && matchesVerb;
  });

  // Return first matching route (most specific)
  return matchingRoutes[0];
}

/**
 * Find matching payment requirements from list
 * 
 * This is a placeholder for finding requirements that match certain criteria.
 * In v2, this logic is typically handled by the x402Client/x402ResourceServer classes.
 * 
 * @param requirements - List of payment requirements
 * @param network - Optional network filter
 * @returns First matching requirement or undefined
 */
export function findMatchingPaymentRequirements<T>(
  requirements: T[],
  network?: string,
): T | undefined {
  // For now, just return the first requirement
  // In a real implementation, this would filter by network, scheme, etc.
  void network; // Mark as intentionally unused
  return requirements[0];
}

/**
 * Convert value to JSON-safe format
 * 
 * Handles BigInt and other non-JSON-serializable types.
 * 
 * @param value - Value to convert
 * @returns JSON-safe representation
 * 
 * @example
 * ```typescript
 * const safe = toJsonSafe({ amount: 1000000n }); // { amount: "1000000" }
 * ```
 */
export function toJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = toJsonSafe(val);
    }
    return result;
  }

  return value;
}
