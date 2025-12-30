/**
 * Anvil Process Manager for E2E Tests
 *
 * Manages Anvil local chain lifecycle for deterministic E2E testing.
 * Provides utilities to start, stop, and monitor Anvil processes.
 */

import { spawn, ChildProcess } from "child_process";

export interface AnvilManagerOptions {
  /**
   * Port for Anvil to listen on
   * @default 8545
   */
  port?: number;

  /**
   * Chain ID for the local chain
   * @default 31337
   */
  chainId?: number;

  /**
   * Block time in seconds (0 for mine on transaction)
   * @default 0
   */
  blockTime?: number;

  /**
   * Fork URL (if forking from existing chain)
   */
  forkUrl?: string;

  /**
   * Additional Anvil arguments
   */
  args?: string[];
}

export interface AnvilManagerConfig {
  process: ChildProcess;
  port: number;
  chainId: number;
  rpcUrl: string;
}

/**
 * Anvil Manager Class
 *
 * Manages the lifecycle of an Anvil process for E2E testing.
 * Ensures proper cleanup on test completion.
 */
export class AnvilManager {
  private config: AnvilManagerConfig | null = null;
  private readonly options: Required<AnvilManagerOptions>;

  constructor(options: AnvilManagerOptions = {}) {
    this.options = {
      port: options.port ?? 8545,
      chainId: options.chainId ?? 31337,
      blockTime: options.blockTime ?? 0,
      forkUrl: options.forkUrl ?? "",
      args: options.args ?? [],
    };
  }

  /**
   * Start Anvil process
   *
   * @returns Promise that resolves when Anvil is ready
   */
  async start(): Promise<AnvilManagerConfig> {
    if (this.config) {
      throw new Error("Anvil is already running");
    }

    const args = [
      "--port",
      this.options.port.toString(),
      "--chain-id",
      this.options.chainId.toString(),
      "--block-time",
      this.options.blockTime.toString(),
    ];

    if (this.options.forkUrl) {
      args.push("--fork-url", this.options.forkUrl);
    }

    args.push(...this.options.args);

    const anvilProcess = spawn("anvil", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ANVIL_IPC_ENABLED: "false",
      },
    });

    // Set up error handling
    anvilProcess.on("error", (err) => {
      console.error("[AnvilManager] Process error:", err);
    });

    // Wait for Anvil to be ready
    await this.waitForReady(anvilProcess);

    this.config = {
      process: anvilProcess,
      port: this.options.port,
      chainId: this.options.chainId,
      rpcUrl: `http://localhost:${this.options.port}`,
    };

    console.log(`[AnvilManager] Started on port ${this.options.port}, chain ID ${this.options.chainId}`);

    return this.config;
  }

  /**
   * Wait for Anvil to be ready by checking stdout
   */
  private async waitForReady(process: ChildProcess, timeout = 30000): Promise<void> {
    let stdoutBuffer = "";
    let stderrBuffer = "";

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Anvil start timeout (${timeout}ms). Stdout: ${stdoutBuffer.slice(-500)}, Stderr: ${stderrBuffer.slice(-500)}`
          )
        );
      }, timeout);

      const cleanup = () => {
        clearTimeout(timeoutHandle);
        process.stdout?.off("data", stdoutHandler);
        process.stderr?.off("data", stderrHandler);
      };

      const stdoutHandler = (data: Buffer) => {
        stdoutBuffer += data.toString();
        // Check for Anvil's ready message
        if (stdoutBuffer.includes("Listening") || stdoutBuffer.includes("0.0.0.0:" + this.options.port)) {
          cleanup();
          resolve();
        }
      };

      const stderrHandler = (data: Buffer) => {
        stderrBuffer += data.toString();
      };

      process.stdout?.on("data", stdoutHandler);
      process.stderr?.on("data", stderrHandler);

      process.on("exit", (code) => {
        cleanup();
        reject(new Error(`Anvil exited with code ${code}. Stderr: ${stderrBuffer}`));
      });
    });
  }

  /**
   * Stop Anvil process
   */
  async stop(): Promise<void> {
    if (!this.config) {
      return;
    }

    const { process } = this.config;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        process.kill("SIGKILL");
        reject(new Error("Anvil stop timeout, killed with SIGKILL"));
      }, 5000);

      process.on("exit", (code) => {
        clearTimeout(timeout);
        console.log(`[AnvilManager] Stopped (exit code ${code})`);
        resolve();
      });

      process.kill("SIGTERM");
    });
  }

  /**
   * Reset Anvil state (useful between tests)
   *
   * Uses Anvil's `anvil_reset` RPC method to clear state
   */
  async reset(): Promise<void> {
    if (!this.config) {
      throw new Error("Anvil is not running");
    }

    // This would require making an RPC call - optional for now
    // We'll use anvil_reset in the tests themselves via viem
  }

  /**
   * Get current configuration
   */
  getConfig(): AnvilManagerConfig | null {
    return this.config;
  }

  /**
   * Check if Anvil is running
   */
  isRunning(): boolean {
    return this.config !== null && this.config.process.exitCode === null;
  }
}

/**
 * Global Anvil manager singleton for use in tests
 */
let globalAnvil: AnvilManager | null = null;

/**
 * Get or create global Anvil instance
 */
export function getGlobalAnvil(options?: AnvilManagerOptions): AnvilManager {
  if (!globalAnvil) {
    globalAnvil = new AnvilManager(options);
  }
  return globalAnvil;
}

/**
 * Stop global Anvil instance if running
 */
export async function stopGlobalAnvil(): Promise<void> {
  if (globalAnvil && globalAnvil.isRunning()) {
    await globalAnvil.stop();
  }
  globalAnvil = null;
}
