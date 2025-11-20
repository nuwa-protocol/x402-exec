import * as React from "react";
import type { HookInfo, NetworkId, Stats, TransactionsQuery } from "@/types/scan";

// API response types
type ApiOverviewResponse = {
  success: boolean;
  data: {
    overview: {
      total_volume: string | number;
      unique_users: number;
      total_transactions: number;
    };
  };
};

type ApiHookItem = {
  id: number;
  address: string;
  name: string;
  description: string | null;
  network: string;
  data: string;
  facilitatorfee: number | string;
  pay_to: string;
  settlement_router: string;
  version: string | null;
  total_transactions: number;
  total_volume: string | number;
  unique_users: number;
  created_at: string;
  updated_at: string;
};

type ApiHooksResponse = {
  success: boolean;
  data: {
    overview: ApiHookItem[];
  };
};

// Transform API overview to Stats type
function transformOverview(apiOverview: ApiOverviewResponse["data"]["overview"]): Stats {
  // total_volume is in USDC atomic units (USDC has 6 decimals), convert to USD
  // Use string manipulation to avoid precision loss with large numbers
  const volumeStr = String(apiOverview.total_volume || "0");
  const volumeBigInt = BigInt(volumeStr);
  // Convert to USD: divide by 1e6 (USDC has 6 decimals)
  // For display purposes, we can use Number, but for very large numbers this might lose precision
  // In production, you might want to keep it as string or use a decimal library
  const volumeUsd = Number(volumeBigInt) / 1e6;

  return {
    transactionVolumeUsd: volumeUsd,
    accountsCount: apiOverview.unique_users || 0,
    transactionsCount: apiOverview.total_transactions || 0,
  };
}

// Transform API hook item to HookInfo
function transformHookItem(hook: ApiHookItem): HookInfo & {
  network: NetworkId;
  totalTransactions: number;
  totalVolume: string;
  uniqueUsers: number;
} {
  return {
    address: hook.address,
    name: hook.name || undefined,
    network: hook.network as NetworkId,
    totalTransactions: hook.total_transactions || 0,
    totalVolume: String(hook.total_volume || "0"),
    uniqueUsers: hook.unique_users || 0,
  };
}

export function useScanStats(query: TransactionsQuery = {}): Stats {
  const [stats, setStats] = React.useState<Stats>({
    transactionVolumeUsd: 0,
    accountsCount: 0,
    transactionsCount: 0,
  });

  React.useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3003";
        const url = `${apiUrl}/api/stats/overview`;

        const resp = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const json = (await resp.json()) as ApiOverviewResponse;

        if (!json.success || !json.data?.overview) {
          throw new Error("Invalid API response");
        }

        if (!cancelled) {
          const transformed = transformOverview(json.data.overview);
          setStats(transformed);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch stats:", err);
          // Keep default empty stats on error
        }
      }
    }

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [
    // Re-fetch when query params change (though API might not support filtering yet)
    (query.networks || []).join(","),
    query.hookAddress || "",
    query.fromTime,
    query.toTime,
  ]);

  return stats;
}

export function useScanHooks(query: TransactionsQuery = {}): Array<
  HookInfo & {
    network: NetworkId;
    totalTransactions: number;
    totalVolume: string;
    uniqueUsers: number;
  }
> {
  const [hooks, setHooks] = React.useState<
    Array<
      HookInfo & {
        network: NetworkId;
        totalTransactions: number;
        totalVolume: string;
        uniqueUsers: number;
      }
    >
  >([]);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchHooks() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3003";
        const url = `${apiUrl}/api/stats/hooks`;

        const resp = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const json = (await resp.json()) as ApiHooksResponse;

        if (!json.success || !json.data?.overview) {
          throw new Error("Invalid API response");
        }

        if (!cancelled) {
          const transformed = json.data.overview.map(transformHookItem);
          setHooks(transformed);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch hooks:", err);
          setHooks([]);
        }
      }
    }

    fetchHooks();

    return () => {
      cancelled = true;
    };
  }, [
    // Re-fetch when query params change (though API might not support filtering yet)
    (query.networks || []).join(","),
    query.hookAddress || "",
    query.fromTime,
    query.toTime,
  ]);

  return hooks;
}
