import { useQuery } from "@tanstack/react-query";
import type {
  HookInfo,
  NetworkId,
  Transaction,
  TransactionsQuery,
  TransactionsResult,
} from "@/types/scan";

// API response type
type ApiTransactionResponse = {
  success: boolean;
  data: {
    items: Array<{
      id: number;
      tx_hash: string;
      network: string;
      time: number; // milliseconds
      from_addr: string;
      to_addr: string;
      hook: string;
      hook_name: string;
      amount: number | string; // wei amount
      block_timestamp: number;
      created_at: string;
    }>;
    page: number;
    limit: number;
    totalPages: number;
  };
};

// Backwards-compatible mock registry (kept for use-hooks-registry).
// In production this is unused; callers should rely on real scan APIs instead.
export const MOCK_HOOKS: Record<string, HookInfo> = {};

const DEFAULT_RESULT: TransactionsResult = {
  items: [],
  page: 1,
  pageSize: 10,
  total: 0,
};

// Transform API transaction to Transaction type
function transformApiTransaction(apiTx: ApiTransactionResponse["data"]["items"][0]): Transaction {
  const hook: HookInfo | undefined = apiTx.hook
    ? {
        address: apiTx.hook,
        name: apiTx.hook_name || undefined,
      }
    : undefined;

  // const timestamp = Math.floor(apiTx.block_timestamp);

  // Ensure network matches NetworkId type
  const network = (apiTx.network || "base") as NetworkId;

  return {
    hash: apiTx.tx_hash || "",
    from: apiTx.from_addr || "",
    to: apiTx.to_addr || "",
    valueWei: String(apiTx.amount || "0"), // Convert to string for wei value
    timestamp: apiTx.block_timestamp,
    network,
    hook,
  };
}

function buildTransactionsQueryKey(query: TransactionsQuery): (string | number | null)[] {
  return [
    "transactions",
    (query.networks || []).join(","),
    query.hookAddress || "",
    query.page ?? 1,
    query.pageSize ?? 10,
    query.fromTime ?? null,
    query.toTime ?? null,
  ];
}

async function fetchTransactions(query: TransactionsQuery): Promise<TransactionsResult> {
  const params = new URLSearchParams();

  // Add pagination params
  const page = query.page || 1;
  const pageSize = query.pageSize || 10;
  params.set("page", String(page));
  params.set("limit", String(pageSize));

  // Add network filter if provided
  if (query.networks && query.networks.length > 0) {
    params.set("networks", query.networks.join(","));
  }

  // Add hook address filter if provided
  if (query.hookAddress) {
    params.set("hook", query.hookAddress);
  }

  // Add time range filters if provided
  if (query.fromTime) {
    params.set("fromTime", String(query.fromTime));
  }
  if (query.toTime) {
    params.set("toTime", String(query.toTime));
  }

  // Use relative path - adjust if backend is on different port
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3003";
  const url = `${apiUrl}/api/transactions${params.toString() ? `?${params.toString()}` : ""}`;

  const resp = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  const json = (await resp.json()) as ApiTransactionResponse;

  if (!json.success || !json.data) {
    throw new Error("Invalid API response");
  }

  const transformedItems = json.data.items.map(transformApiTransaction);
  // Calculate total: if we're on the last page, use items count + (page-1) * limit
  // Otherwise, use totalPages * limit as upper bound
  const isLastPage = json.data.page >= json.data.totalPages;
  const total = isLastPage
    ? (json.data.page - 1) * json.data.limit + transformedItems.length
    : json.data.totalPages * json.data.limit;

  return {
    items: transformedItems,
    page: json.data.page,
    pageSize: json.data.limit,
    total,
  };
}

export function useTransactions(query: TransactionsQuery = {}): TransactionsResult {
  const queryResult = useQuery<TransactionsResult, Error>({
    queryKey: buildTransactionsQueryKey(query),
    queryFn: () => fetchTransactions(query),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const fallbackPage = query.page || DEFAULT_RESULT.page;
  const fallbackPageSize = query.pageSize || DEFAULT_RESULT.pageSize;

  const data = queryResult.data ?? {
    ...DEFAULT_RESULT,
    page: fallbackPage,
    pageSize: fallbackPageSize,
  };

  return data;
}

export function formatNetwork(n: NetworkId): string {
  switch (n) {
    case "base":
      return "Base";
    case "base-sepolia":
      return "Base Sepolia";
    case "x-layer":
      return "X Layer";
    case "x-layer-testnet":
      return "X Layer Testnet";
    default:
      return String(n);
  }
}
