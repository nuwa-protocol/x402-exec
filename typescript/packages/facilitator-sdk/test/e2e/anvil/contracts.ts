/**
 * Contract Deployment Utilities for E2E Tests
 *
 * Handles deployment of test contracts to Anvil local chain.
 * Includes ERC20 token with EIP-3009 support, SettlementRouter, and test hooks.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mine } from "viem/test-helpers";
import { readFileSync } from "fs";
import { join } from "path";

// Import ABIs
const ERC3009_TOKEN_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "transferWithAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "authorizationState",
    stateMutability: "view",
    inputs: [{ name: "authorizer", type: "address" }, { name: "nonce", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "AuthorizationUsed",
    inputs: [
      { name: "authorizer", type: "address", indexed: true },
      { name: "nonce", type: "bytes32", indexed: true },
    ],
  },
] as const;

const SETTLEMENT_ROUTER_ABI = [
  {
    type: "function",
    name: "settleAndExecute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "from", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
      { name: "salt", type: "bytes32" },
      { name: "payTo", type: "address" },
      { name: "facilitatorFee", type: "uint256" },
      { name: "hook", type: "address" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isSettled",
    stateMutability: "view",
    inputs: [{ name: "contextKey", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "calculateCommitment",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "from", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "salt", type: "bytes32" },
      { name: "payTo", type: "address" },
      { name: "facilitatorFee", type: "uint256" },
      { name: "hook", type: "address" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "calculateContextKey",
    stateMutability: "pure",
    inputs: [
      { name: "from", type: "address" },
      { name: "token", type: "bytes32" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "contextKey", type: "bytes32", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
      { name: "hook", type: "address", indexed: true },
      { name: "salt", type: "bytes32", indexed: false },
      { name: "payTo", type: "address", indexed: false },
      { name: "facilitatorFee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "HookExecuted",
    inputs: [
      { name: "contextKey", type: "bytes32", indexed: true },
      { name: "hook", type: "address", indexed: true },
      { name: "result", type: "bytes", indexed: false },
    ],
  },
  {
    type: "function",
    name: "getPendingFees",
    stateMutability: "view",
    inputs: [
      { name: "facilitator", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const TRANSFER_HOOK_ABI = [
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "contextKey", type: "bytes32" },
      { name: "payer", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "salt", type: "bytes32" },
      { name: "payTo", type: "address" },
      { name: "facilitator", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "contextKey", type: "bytes32", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

/**
 * Deployed contracts interface
 */
export interface DeployedContracts {
  /**
   * ERC20 token with EIP-3009 support
   */
  token: {
    address: Address;
    abi: typeof ERC3009_TOKEN_ABI;
  };

  /**
   * SettlementRouter contract
   */
  settlementRouter: {
    address: Address;
    abi: typeof SETTLEMENT_ROUTER_ABI;
  };

  /**
   * TransferHook contract
   */
  transferHook: {
    address: Address;
    abi: typeof TRANSFER_HOOK_ABI;
  };

  /**
   * Test accounts
   */
  accounts: {
    deployer: Address;
    facilitator: Address;
    payer: Address;
    merchant: Address;
  };
}

/**
 * Deploy test contracts to Anvil
 *
 * Reads compiled contract artifacts and deploys them using viem.
 *
 * @param rpcUrl - RPC URL of Anvil instance
 * @param privateKey - Private key of deployer account (default Anvil account #0)
 * @returns Deployed contract addresses and ABIs
 */
export async function deployTestContracts(
  rpcUrl: string,
  privateKey: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex
): Promise<DeployedContracts> {
  // Create clients
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    transport: http(rpcUrl),
  });

  // Read compiled contract bytecode
  // Note: These files need to be generated by running `forge build` first
  const contractsDir = join(process.cwd(), "../../../../contracts/out");

  // Deploy MockUSDCWithSignatureValidation (ERC20 + EIP-3009)
  const tokenBytecode = readFileSync(
    join(contractsDir, "test/mocks/MockUSDCWithSignatureValidation.sol/MockUSDCWithSignatureValidation.json"),
    "utf-8"
  );
  const tokenArtifact = JSON.parse(tokenBytecode);
  const tokenAddress = (await walletClient.deployContract({
    abi: tokenArtifact.abi,
    bytecode: tokenArtifact.bytecode.object as `0x${string}`,
    args: [],
  })) as Address;

  console.log(`[Deploy] Token at ${tokenAddress}`);

  // Deploy SettlementRouter
  const routerBytecode = readFileSync(
    join(contractsDir, "src/SettlementRouter.sol/SettlementRouter.json"),
    "utf-8"
  );
  const routerArtifact = JSON.parse(routerBytecode);
  const routerAddress = (await walletClient.deployContract({
    abi: routerArtifact.abi,
    bytecode: routerArtifact.bytecode.object as `0x${string}`,
    args: [],
  })) as Address;

  console.log(`[Deploy] SettlementRouter at ${routerAddress}`);

  // Deploy TransferHook
  const hookBytecode = readFileSync(
    join(contractsDir, "src/hooks/TransferHook.sol/TransferHook.json"),
    "utf-8"
  );
  const hookArtifact = JSON.parse(hookBytecode);
  const hookAddress = (await walletClient.deployContract({
    abi: hookArtifact.abi,
    bytecode: hookArtifact.bytecode.object as `0x${string}`,
    args: [routerAddress],
  })) as Address;

  console.log(`[Deploy] TransferHook at ${hookAddress}`);

  // Wait for deployments
  await mine(publicClient, { blocks: 1 });

  // Define test accounts (Anvil default accounts)
  const accounts = {
    deployer: account.address,
    facilitator: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address, // Anvil account #1
    payer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Address, // Anvil account #2
    merchant: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as Address, // Anvil account #3
  };

  // Mint tokens to payer
  const mintAmount = 1000000000000n; // 1,000,000 tokens (6 decimals)
  await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC3009_TOKEN_ABI,
    functionName: "mint",
    args: [accounts.payer, mintAmount],
  });

  await mine(publicClient, { blocks: 1 });

  console.log(`[Deploy] Minted ${mintAmount} tokens to payer`);

  return {
    token: {
      address: tokenAddress,
      abi: ERC3009_TOKEN_ABI,
    },
    settlementRouter: {
      address: routerAddress,
      abi: SETTLEMENT_ROUTER_ABI,
    },
    transferHook: {
      address: hookAddress,
      abi: TRANSFER_HOOK_ABI,
    },
    accounts,
  };
}

/**
 * Get viem Chain config for Anvil
 */
export function getAnvilChain(rpcUrl: string) {
  return {
    id: 31337,
    name: "Anvil",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
  };
}
