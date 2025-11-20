/**
 * Hook Validator Types
 *
 * Defines interfaces for hook validation and gas estimation
 */

/**
 * Hook validation result
 */
export interface HookValidationResult {
  /** Whether the hook data is valid */
  isValid: boolean;
  /** Error message if invalid */
  errorReason?: string;
  /** Validation method used (code_validation or gas_estimation) */
  validationMethod: "code_validation" | "gas_estimation";
}

/**
 * Gas estimation and validation result
 */
export interface GasEstimationResult {
  /** Whether the estimation/validation succeeded */
  isValid: boolean;
  /** Error message if invalid */
  errorReason?: string;
  /** Estimated gas limit if successful */
  gasLimit?: number;
  /** Validation method used */
  validationMethod: "code_validation" | "gas_estimation";
}

/**
 * Hook validator interface
 */
export interface HookValidator {
  /**
   * Validate hook data for a specific hook
   *
   * @param network - Network name
   * @param hookAddress - Hook contract address
   * @param hookData - Encoded hook parameters
   * @param hookAmount - Amount available for hook execution
   * @returns Validation result
   */
  validate(
    network: string,
    hookAddress: string,
    hookData: string,
    hookAmount: bigint,
  ): HookValidationResult;

  /**
   * Get gas overhead for this hook type
   *
   * @param network - Network name
   * @param hookAddress - Hook contract address
   * @param hookData - Optional hook data for dynamic overhead calculation
   * @returns Gas overhead in addition to base transaction cost
   */
  getGasOverhead(network: string, hookAddress: string, hookData?: string): number;
}

/**
 * Built-in hook types
 */
export enum BuiltInHookType {
  TRANSFER = "transfer",
}

/**
 * Hook type identification result
 */
export interface HookTypeInfo {
  /** Whether this is a built-in hook */
  isBuiltIn: boolean;
  /** Hook type identifier (for built-in hooks) */
  hookType?: BuiltInHookType;
  /** Validator instance (for built-in hooks) */
  validator?: HookValidator;
}
