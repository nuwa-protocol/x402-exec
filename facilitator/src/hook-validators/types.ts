/**
 * Hook Validator Types
 *
 * Defines interfaces for hook validation.
 *
 * NOTE: HookValidator does NOT calculate gas overhead.
 * Gas calculation is the responsibility of GasEstimationStrategy implementations.
 * This keeps the validator focused on a single responsibility: validation.
 */

/**
 * Hook validation result (simplified - no gas info)
 */
export interface HookValidationResult {
  /** Whether the hook data is valid */
  isValid: boolean;
  /** Error message if invalid */
  errorReason?: string;
}

/**
 * Hook validator interface
 *
 * Responsibility: Validate hook parameters correctness
 *
 * NOTE: This interface does NOT include gas calculation methods.
 * Gas estimation is handled by GasEstimationStrategy implementations.
 */
export interface HookValidator {
  /**
   * Validate hook parameters
   *
   * Pure validation logic - checks if parameters are correct
   * without any RPC calls or gas calculations.
   *
   * @param network - Network name
   * @param hookAddress - Hook contract address
   * @param hookData - Encoded hook parameters
   * @param hookAmount - Amount available for hook execution
   * @returns Validation result (only validity, no gas information)
   */
  validate(
    network: string,
    hookAddress: string,
    hookData: string,
    hookAmount: bigint,
  ): HookValidationResult;
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
