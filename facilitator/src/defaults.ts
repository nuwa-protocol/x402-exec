/**
 * Default Configuration Values
 *
 * Single source of truth for all default configuration values.
 * Used across:
 * - Runtime configuration (config.ts)
 * - Documentation (README.md, env.example)
 * - Tests (unit tests, e2e tests)
 *
 * When modifying defaults, update this file only.
 */

/**
 * Gas cost default configuration
 */
export const GAS_COST_DEFAULTS = {
  /** Minimum gas limit to ensure transaction can execute */
  MIN_GAS_LIMIT: 150000,

  /** Maximum gas limit per transaction (absolute safety cap for L2 chains) */
  MAX_GAS_LIMIT: 5000000,

  /** Profit margin reserved when calculating dynamic gas limit (0-1) */
  DYNAMIC_GAS_LIMIT_MARGIN: 0.2,

  /** Additional gas overhead for TransferHook */
  HOOK_TRANSFER_OVERHEAD: 50000,

  /** Additional gas overhead for custom hooks */
  HOOK_CUSTOM_OVERHEAD: 100000,

  /** Safety multiplier for gas estimation */
  SAFETY_MULTIPLIER: 1.5,

  /** Tolerance for fee validation (0-1) */
  VALIDATION_TOLERANCE: 0.1,

  /** Minimum facilitator fee in USD */
  MIN_FACILITATOR_FEE_USD: 0.01,
} as const;

/**
 * Cache default configuration
 */
export const CACHE_DEFAULTS = {
  /** Enable caching */
  ENABLED: true,

  /** Token version cache TTL (seconds) */
  TTL_TOKEN_VERSION: 3600,

  /** Token metadata cache TTL (seconds) */
  TTL_TOKEN_METADATA: 3600,

  /** Maximum number of cache keys */
  MAX_KEYS: 1000,
} as const;

/**
 * Server default configuration
 */
export const SERVER_DEFAULTS = {
  /** Server port */
  PORT: 3000,

  /** Shutdown timeout (milliseconds) */
  SHUTDOWN_TIMEOUT_MS: 30000,

  /** Request body size limit */
  REQUEST_BODY_LIMIT: "1mb",
} as const;

/**
 * Rate limiting default configuration
 */
export const RATE_LIMIT_DEFAULTS = {
  /** Enable rate limiting */
  ENABLED: true,

  /** Max requests per time window for /verify endpoint */
  VERIFY_MAX: 100,

  /** Max requests per time window for /settle endpoint */
  SETTLE_MAX: 20,

  /** Rate limit time window (milliseconds) */
  WINDOW_MS: 60000,
} as const;

/**
 * Account pool default configuration
 */
export const ACCOUNT_POOL_DEFAULTS = {
  /** Account selection strategy */
  STRATEGY: "round_robin" as const,

  /** Maximum queue depth per account (prevent request accumulation) */
  MAX_QUEUE_DEPTH: 10,
} as const;

/**
 * Hook security default configuration
 *
 * Note: Settlement Router address validation is ALWAYS enabled and cannot be disabled.
 * Only Hook address validation can be optionally enabled via whitelist.
 */
export const HOOK_SECURITY_DEFAULTS = {
  /**
   * Enable hook whitelist validation (default: false)
   *
   * When enabled, only hooks in the whitelist can be executed.
   * When disabled, any hook address can be used (less secure, for development only).
   *
   * Important: This only controls HOOK validation. Settlement Router addresses
   * are ALWAYS validated against a whitelist for security.
   */
  WHITELIST_ENABLED: false,
} as const;

/**
 * Dynamic gas price default configuration
 */
export const DYNAMIC_GAS_PRICE_DEFAULTS = {
  /** Gas price strategy */
  STRATEGY: "hybrid" as const,

  /** Cache TTL (seconds) */
  CACHE_TTL: 300,

  /** Background update interval (seconds) */
  UPDATE_INTERVAL: 60,
} as const;

/**
 * Token price default configuration
 */
export const TOKEN_PRICE_DEFAULTS = {
  /** Enable dynamic token price fetching */
  ENABLED: true,

  /** Cache TTL (seconds) */
  CACHE_TTL: 3600,

  /** Background update interval (seconds) */
  UPDATE_INTERVAL: 600,
} as const;

/**
 * Default native token prices (USD)
 */
export const NATIVE_TOKEN_PRICE_DEFAULTS = {
  /** ETH price for Base networks */
  ETH: 3000,

  /** OKB price for X-Layer networks */
  OKB: 50,

  /** CREDIT price for SKALE networks (1 USD = 4 CREDIT) */
  CREDIT: 0.25,

  /** Generic fallback */
  GENERIC: 100,
} as const;

/**
 * Default gas prices (Wei) for testnet
 */
export const GAS_PRICE_DEFAULTS = {
  /** Base Sepolia */
  BASE_SEPOLIA: "1000000000", // 1 gwei

  /** X-Layer Testnet */
  X_LAYER_TESTNET: "100000000", // 0.1 gwei
} as const;

/**
 * Fee claim default configuration
 */
export const FEE_CLAIM_DEFAULTS = {
  /** Minimum claim amount for USDC (6 decimals): 1 USDC = 1,000,000.
   *  If using a token with different decimals, adjust this value accordingly (e.g., 1e18 for 18-decimal tokens).
   */
  MIN_CLAIM_AMOUNT_USDC: "1000000", // 1 USDC (6 decimals)
} as const;

/**
 * Complete default configuration type
 */
export interface DefaultConfig {
  gasCost: typeof GAS_COST_DEFAULTS;
  cache: typeof CACHE_DEFAULTS;
  accountPool: typeof ACCOUNT_POOL_DEFAULTS;
  server: typeof SERVER_DEFAULTS;
  rateLimit: typeof RATE_LIMIT_DEFAULTS;
  hookSecurity: typeof HOOK_SECURITY_DEFAULTS;
  dynamicGasPrice: typeof DYNAMIC_GAS_PRICE_DEFAULTS;
  tokenPrice: typeof TOKEN_PRICE_DEFAULTS;
  nativeTokenPrice: typeof NATIVE_TOKEN_PRICE_DEFAULTS;
  gasPrice: typeof GAS_PRICE_DEFAULTS;
  feeClaim: typeof FEE_CLAIM_DEFAULTS;
}

/**
 * All defaults in one object
 */
export const DEFAULTS: DefaultConfig = {
  gasCost: GAS_COST_DEFAULTS,
  cache: CACHE_DEFAULTS,
  accountPool: ACCOUNT_POOL_DEFAULTS,
  server: SERVER_DEFAULTS,
  rateLimit: RATE_LIMIT_DEFAULTS,
  hookSecurity: HOOK_SECURITY_DEFAULTS,
  dynamicGasPrice: DYNAMIC_GAS_PRICE_DEFAULTS,
  tokenPrice: TOKEN_PRICE_DEFAULTS,
  nativeTokenPrice: NATIVE_TOKEN_PRICE_DEFAULTS,
  gasPrice: GAS_PRICE_DEFAULTS,
  feeClaim: FEE_CLAIM_DEFAULTS,
} as const;
