/**
 * Global type declarations for runtime environments
 */

declare const console: Console;

interface Console {
  log(...data: any[]): void;
  warn(...data: any[]): void;
  error(...data: any[]): void;
}

interface Crypto {
  getRandomValues<T extends Int8Array | Uint8Array>(array: T): T;
}
