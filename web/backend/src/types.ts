/**
 * Core type definitions for x402 Scanner Backend
 */

/**
 * Network type
 */
export type NetworkType = 'mainnet' | 'testnet';

/**
 * Network name
 */
export type NetworkName = 'base' | 'base-sepolia' | 'x-layer' | 'x-layer-testnet';

/**
 * Transaction status
 */
export type TransactionStatus = 'success' | 'failed' | 'pending';

/**
 * Block explorer API type
 */
export type ExplorerApiType = 'etherscan' | 'oklink';

/**
 * Network database record
 */
export interface Network {
  id: number;
  name: NetworkName;
  chain_id: number;
  settlement_router: string;
  explorer_api_url: string;
  explorer_api_type: ExplorerApiType;
  usdc_address: string;
  type: NetworkType;
  is_active: boolean;
  last_indexed_timestamp: number;
  last_indexed_block_height: string;
  created_at: string;
}

/**
 * Transaction database record
 */
export interface Transaction {
  id: number;
  tx_hash: string;
  network: NetworkName;
  block_number: number;
  block_timestamp: number;
  
  // Settled event data
  context_key: string;
  payer: string;
  token: string;
  amount: string;
  hook: string | null;
  salt: string;
  pay_to: string;
  facilitator_fee: string;
  
  // Transaction metadata
  facilitator: string;
  gas_used: number | null;
  gas_price: string | null;
  status: TransactionStatus;
  from: string;
  to: string;
  
  created_at: string;
}

/**
 * Transaction API response
 */
export interface TransactionResponse {
  txHash: string;
  network: NetworkName;
  blockNumber: number;
  timestamp: string;
  
  // Settlement info
  contextKey: string;
  payer: string;
  token: string;
  amount: string;
  amountFormatted: string;
  hook: string | null;
  hookName?: string;
  salt: string;
  payTo: string;
  facilitatorFee: string;
  facilitatorFeeFormatted: string;
  from: string;
  to: string;
  
  // Facilitator info
  facilitator: string;
  
  // Gas info
  gasUsed: string | null;
  gasPrice: string | null;
  gasCost: string | null;
  
  // Status
  status: TransactionStatus;
  
  // Explorer URL
  explorerUrl: string;
}

/**
 * Hook database record
 */
export interface Hook {
  id: number;
  address: string;
  network: NetworkName;
  name: string;
  description: string | null;
  category: string | null;
  version: string | null;
  author: string | null;
  website: string | null;
  github: string | null;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  
  // Cached stats
  total_transactions: number;
  total_volume: string;
  unique_users: number;
  
  created_at: string;
  updated_at: string;
}

/**
 * Hook API response
 */
export interface HookResponse {
  address: string;
  network: NetworkName;
  name: string;
  description?: string;
  category?: string;
  version?: string;
  author?: string;
  website?: string;
  github?: string;
  isVerified: boolean;
  
  stats: {
    totalTransactions: number;
    totalVolume: string;
    uniqueUsers: number;
  };
  
  createdAt: string;
}

/**
 * Statistics database record
 */
export interface Statistics {
  id: number;
  network: NetworkName | null;
  hook: string | null;
  facilitator: string | null;
  date: string | null;
  
  transaction_count: number;
  total_volume: string;
  total_volume_usd: number;
  unique_payers: number;
  
  updated_at: string;
}

/**
 * Statistics API response
 */
export interface StatsResponse {
  overview: {
    totalTransactions: number;
    totalVolumeUSD: string;
    uniquePayers: number;
    uniqueFacilitators: number;
    averageTransactionSize: string;
    averageFacilitatorFee: string;
  };
  
  byNetwork: Record<NetworkName, {
    transactions: number;
    volumeUSD: string;
    uniquePayers: number;
  }>;
  
  byHook: Array<{
    hook: string;
    hookName?: string;
    transactions: number;
    volumeUSD: string;
    uniqueUsers: number;
  }>;
  
  byFacilitator: Array<{
    facilitator: string;
    transactions: number;
    volumeUSD: string;
    totalFeesEarned: string;
  }>;
  
  timeSeries?: Array<{
    date: string;
    transactions: number;
    volumeUSD: string;
  }>;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Pagination response
 */
export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Transaction query parameters
 */
export interface TransactionQueryParams extends PaginationParams {
  network?: NetworkName;
  hook?: string;
  payer?: string;
  facilitator?: string;
  sortBy?: 'timestamp' | 'amount';
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

/**
 * Hook query parameters
 */
export interface HookQueryParams extends PaginationParams {
  network?: NetworkName;
  category?: string;
  verified?: boolean;
}

/**
 * Stats query parameters
 */
export interface StatsQueryParams {
  network?: NetworkName;
  hook?: string;
  facilitator?: string;
  period?: 'day' | 'week' | 'month' | 'all';
}

/**
 * Settled event data (parsed from blockchain)
 */
export interface SettledEvent {
  contextKey: string;
  payer: string;
  token: string;
  amount: bigint;
  hook: string;
  salt: string;
  payTo: string;
  facilitatorFee: bigint;
}

/**
 * Raw transaction log from block explorer
 */
export interface RawTransactionLog {
  transactionHash: string;
  blockNumber: number;
  blockTimestamp: number;
  from: string;
  to: string;
  gasUsed?: number;
  gasPrice?: string;
  status: TransactionStatus;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}

/**
 * Parsed transaction ready for database insertion
 */
export interface ParsedTransaction {
  txHash: string;
  network: NetworkName;
  blockNumber: number;
  blockTimestamp: number;
  
  // Settled event
  contextKey: string;
  payer: string;
  token: string;
  amount: string;
  hook: string | null;
  salt: string;
  payTo: string;
  facilitatorFee: string;
  
  // Metadata
  facilitator: string;
  gasUsed: number | null;
  gasPrice: string | null;
  status: TransactionStatus;
  from: string;
  to: string;
}

/**
 * Sync status type
 */
export type SyncStatus = 'not_started' | 'synced' | 'delayed' | 'critical';

/**
 * Network sync status
 */
export interface NetworkSyncStatus {
  name: NetworkName;
  chainId: number;
  isActive: boolean;
  lastIndexedTimestamp: number;
  lastIndexedAt: string | null;
  lagSeconds: number;
  lagMinutes: number;
  syncStatus: SyncStatus;
  syncStatusLabel: string;
}

