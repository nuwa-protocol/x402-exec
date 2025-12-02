/**
 * Stats Routes
 *
 * Aggregates on-chain SettlementRouter activity to expose simple stats:
 * - GET /stats: Overall stats + per-payer breakdown (across supported networks)
 *
 * Notes:
 * - We scan the `Settled` event from the SettlementRouter on each supported network.
 * - By default, we look back a limited block window to avoid heavy queries.
 *   You can control the range via query parameters or environment variables.
 */

import { Router, Request, Response } from "express";
import { createPublicClient, http, decodeEventLog } from "viem";
import { getNetworkConfig, getSupportedNetworks } from "@x402x/core";
import type { DynamicGasPriceConfig } from "../dynamic-gas-price.js";
import { getLogger } from "../telemetry.js";

const logger = getLogger();

// Minimal ABI for SettlementRouter.Settled event (indexed fields must match signature)
const SETTLED_EVENT_ABI = [
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "contextKey", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "hook", type: "address", indexed: false },
      { name: "salt", type: "bytes32", indexed: false },
      { name: "payTo", type: "address", indexed: false },
      { name: "facilitatorFee", type: "uint256", indexed: false },
    ],
  },
] as const;

type SettledEvent = {
  contextKey: `0x${string}`;
  payer: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  hook: `0x${string}`;
  salt: `0x${string}`;
  payTo: `0x${string}`;
  facilitatorFee: bigint;
};

/**
 * Dependencies required by stats routes
 */
export interface StatsRouteDependencies {
  allowedSettlementRouters: Record<string, string[]>;
  dynamicGasPrice: DynamicGasPriceConfig;
}

/**
 * Create stats routes
 */
export function createStatsRoutes(deps: StatsRouteDependencies): Router {
  const router = Router();

  // GET /stats - overall + per address summary
  router.get("/stats", async (req: Request, res: Response) => {
    try {
      // Optional: restrict to specific networks via ?networks=base,x-layer
      const networksParam = String(req.query.networks || "").trim();
      const requestedNetworks = networksParam
        ? networksParam
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean)
        : undefined;

      const supported = getSupportedNetworks();
      const networks = (requestedNetworks || supported).filter((n) => supported.includes(n));

      // Optional lookback config
      const maxBlocks = parseInt(
        String(req.query.maxBlocks || process.env.STATS_LOOKBACK_BLOCKS || "200000"),
      );

      // Optional per-network fromBlock override via env, e.g. BASE_FROM_BLOCK, X_LAYER_FROM_BLOCK
      const envFromBlock = (network: string) => {
        const key = `${network.toUpperCase().replace(/-/g, "_")}_STATS_FROM_BLOCK`;
        const v = process.env[key];
        return v ? BigInt(v) : undefined;
      };

      const perPayer: Map<string, { txCount: number; total: bigint }> = new Map();
      const perHook: Map<string, { txCount: number; total: bigint; uniquePayers: Set<string> }> =
        new Map();
      let totalTx = 0;
      let totalValue = 0n;
      const uniquePayers = new Set<string>();

      const scanned: Array<{
        network: string;
        router: string;
        fromBlock: bigint;
        toBlock: bigint;
        count: number;
      }> = [];

      for (const network of networks) {
        // Determine RPC URL
        const rpcUrl = deps.dynamicGasPrice.rpcUrls[network];
        if (!rpcUrl) {
          logger.warn({ network }, "No RPC URL configured for network, skipping stats");
          continue;
        }

        // Determine router address (we only support the first configured router per network)
        const routers = deps.allowedSettlementRouters[network] || [];
        const routerAddress = routers[0];
        if (!routerAddress) {
          logger.warn({ network }, "No SettlementRouter configured for network, skipping");
          continue;
        }

        const client = createPublicClient({ transport: http(rpcUrl) });
        const latest = await client.getBlockNumber();

        // Best-effort fromBlock
        const envFrom = envFromBlock(network);
        const from = envFrom ?? (latest > BigInt(maxBlocks) ? latest - BigInt(maxBlocks) : 0n);
        const to = latest;

        // Constrain to the default USDC token for this network so that "value" is unambiguous
        let usdc: `0x${string}` | undefined = undefined;
        try {
          const cfg = getNetworkConfig(network);
          usdc = cfg?.defaultAsset?.address?.toLowerCase() as `0x${string}` | undefined;
        } catch {}

        // Scan logs in chunks to avoid provider limits
        const chunk = 20_000n; // blocks per request
        let start = from;
        let matched = 0;
        while (start <= to) {
          const end = start + chunk > to ? to : start + chunk;

          const logs = await client.getLogs({
            address: routerAddress as `0x${string}`,
            fromBlock: start,
            toBlock: end,
            abi: SETTLED_EVENT_ABI,
            eventName: "Settled",
          } as any);

          for (const log of logs as any[]) {
            try {
              const decoded = decodeEventLog({
                abi: SETTLED_EVENT_ABI,
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName !== "Settled") continue;
              const args = decoded.args as unknown as SettledEvent;
              if (usdc && args.token.toLowerCase() !== usdc) continue;

              matched += 1;
              totalTx += 1;
              totalValue += args.amount;
              const payer = args.payer.toLowerCase();
              uniquePayers.add(payer);
              const entry = perPayer.get(payer) || { txCount: 0, total: 0n };
              entry.txCount += 1;
              entry.total += args.amount;
              perPayer.set(payer, entry);

              const hookAddr = (
                args.hook || "0x0000000000000000000000000000000000000000"
              ).toLowerCase();
              const hookAgg = perHook.get(hookAddr) || {
                txCount: 0,
                total: 0n,
                uniquePayers: new Set<string>(),
              };
              hookAgg.txCount += 1;
              hookAgg.total += args.amount;
              hookAgg.uniquePayers.add(payer);
              perHook.set(hookAddr, hookAgg);
            } catch (err) {
              logger.debug({ err }, "Failed to decode Settled log");
            }
          }

          start = end + 1n;
        }

        scanned.push({
          network,
          router: routerAddress,
          fromBlock: from,
          toBlock: to,
          count: matched,
        });
      }

      // Prepare response
      const payers = Array.from(perPayer.entries())
        .map(([address, v]) => ({ address, txCount: v.txCount, total: v.total.toString() }))
        .sort((a, b) => Number(BigInt(b.total) - BigInt(a.total)))
        .slice(0, 200); // cap to 200 to keep payload small

      const topHooks = Array.from(perHook.entries())
        .map(([address, v]) => ({
          address,
          txCount: v.txCount,
          uniquePayers: v.uniquePayers.size,
          total: v.total.toString(),
        }))
        .sort((a, b) => Number(BigInt(b.total) - BigInt(a.total)))
        .slice(0, 200);

      res.json({
        networks,
        scanned,
        transactionsCount: totalTx,
        accountsCount: uniquePayers.size,
        totalValueAtomic: totalValue.toString(), // raw token units (USDC on supported networks)
        payers,
        topHooks,
      });
    } catch (error) {
      logger.error({ error }, "Stats error");
      res.status(500).json({ error: "stats_failed", message: "Unable to compute stats" });
    }
  });

  return router;
}
