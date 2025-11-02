/**
 * Client configuration
 * Manages environment variables and runtime configuration
 */

/**
 * Get the API base URL
 * In development: uses empty string to leverage Vite proxy
 * In production: uses VITE_SERVER_URL environment variable
 */
export function getServerUrl(): string {
  const serverUrl = import.meta.env.VITE_SERVER_URL;
  
  // If no server URL is set, use relative paths (Vite proxy in dev, or same-origin in production)
  if (!serverUrl) {
    return '';
  }
  
  // Remove trailing slash if present
  return serverUrl.replace(/\/$/, '');
}

/**
 * Build API endpoint URL
 * @param path - API path (e.g., '/api/health' or 'api/health')
 * @returns Full URL or relative path
 */
export function buildApiUrl(path: string): string {
  const serverUrl = getServerUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return serverUrl ? `${serverUrl}${normalizedPath}` : normalizedPath;
}

// Export configuration object for convenience
export const config = {
  serverUrl: getServerUrl(),
  buildApiUrl,
};

