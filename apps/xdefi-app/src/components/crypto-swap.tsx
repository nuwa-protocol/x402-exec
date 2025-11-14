"use client";

import { modal as appKitModal } from "@reown/appkit/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDown,
  CheckCircle,
  ChevronDown,
  Loader2,
  Search,
  Settings,
  Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
// Wallet connection guard: use wagmi account state + AppKit modal
// Import the shared modal instance to open on demand without using the hook
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import AssetLogo from "@/components/asset-logo";
import {
  SUPPORTED_NETWORKS,
  SUPPORTED_PAYMENT_TOKENS,
} from "@/constants/networks";
import { useTargetAssets } from "@/hooks/use-target-assets";
import { okxGetQuote, okxGetTokenPrice } from "@/lib/okx";
import { cn } from "@/lib/utils";

// Hook for click outside functionality
function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
  mouseEvent: "mousedown" | "mouseup" = "mousedown",
): void {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref?.current;
      const target = event.target;

      if (!el || !target || el.contains(target as Node)) {
        return;
      }

      handler(event);
    };

    document.addEventListener(mouseEvent, listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener(mouseEvent, listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler, mouseEvent]);
}

interface Token {
  symbol: string;
  name: string;
  // icon is unused now; we render with <AssetLogo/>
  icon?: string;
  // Optional remote token logo URL (e.g., from OKX)
  logoUrl?: string;
  balance: string;
  price: number;
  change24h: number;
  address: string;
  decimals?: number;
}

interface Network {
  id: string; // network key from SDK (e.g., 'base', 'base-sepolia')
  name: string;
  // icon is unused now; we render with <AssetLogo/>
  icon?: string;
  tokens: Token[];
}

interface SwapState {
  fromNetwork: Network;
  toNetwork: Network;
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  slippage: number;
  isLoading: boolean;
  status: "idle" | "loading" | "success" | "error";
  error?: string;
}

// Build networks from the SDK's supported list (constants are already filtered to mainnet only).
function buildNetworksFromSDK(): Network[] {
  return SUPPORTED_NETWORKS.map((n) => {
    const tokens = (SUPPORTED_PAYMENT_TOKENS[n.network] ?? []).map(
      (t): Token => ({
        symbol: t.symbol,
        name: t.label ?? t.symbol,
        balance: "0",
        price: t.symbol.toUpperCase() === "USDC" ? 1 : 1, // default to 1; pricing is out of scope here
        change24h: 0,
        address: t.address,
        // Default decimals: USDC=6; otherwise assume 18
        decimals: t.symbol.toUpperCase() === "USDC" ? 6 : 18,
      }),
    );
    // Remove the word "Mainnet" from display name when showing
    const displayName = n.name.replace(/\s*Mainnet\b/i, "");
    return {
      id: n.network,
      name: displayName,
      tokens,
    };
  });
}

type Mode = "swap" | "bridge";

// Internal base component used by the SwapComponent and BridgeComponent wrappers.
// Consumers should import/use the specific components instead of a generic "mode" prop.
function CryptoSwapBase({
  mode,
  networks,
}: {
  mode: Mode;
  networks?: Network[];
}) {
  const { isConnected, address } = useAccount();
  // Memoize fromNetworks so effects don't retrigger on every render
  const fromNetworks = React.useMemo(
    () => (networks && networks.length > 0 ? networks : buildNetworksFromSDK()),
    [networks],
  );
  const initialFromNetwork = fromNetworks[0];
  // to networks come from API (mock hook for now). We'll compute after state init.
  const [swapState, setSwapState] = useState<SwapState>({
    fromNetwork: initialFromNetwork,
    toNetwork: initialFromNetwork, // temp init, will update once hook resolves
    fromToken: initialFromNetwork.tokens[0],
    toToken: initialFromNetwork.tokens[0],
    fromAmount: "",
    toAmount: "",
    slippage: 0.5,
    isLoading: false,
    status: "idle",
  });

  // Load target assets based on current selection
  const { networks: toNetworks, loading: toLoading } = useTargetAssets({
    mode,
    fromNetworkId: swapState.fromNetwork?.id,
  });

  // Initialize or reconcile the From side when the available from-networks list changes
  // Keep the user's manual selection intact if still valid; only reset if invalid or empty
  useEffect(() => {
    const nextFrom = fromNetworks?.[0];
    if (!nextFrom) return;
    setSwapState((prev) => {
      const stillValid = fromNetworks.some(
        (n) => n.id === prev.fromNetwork?.id,
      );
      if (stillValid) return prev;
      return {
        ...prev,
        fromNetwork: nextFrom,
        fromToken: nextFrom.tokens[0],
      };
    });
  }, [fromNetworks]);

  // Initialize or reconcile the To side whenever its candidate list changes
  // Always adopt the latest token list for the selected "to" network so the UI is populated on first load.
  // Preserve the previously selected token if it exists in the new list; otherwise default to the first token.
  useEffect(() => {
    const nextTo = toNetworks?.[0];
    if (!nextTo) return;
    setSwapState((prev) => {
      const prevAddr = prev.toToken?.address?.toLowerCase?.();
      const nextTokens = (nextTo.tokens as any[]) ?? [];
      const matched =
        nextTokens.find((t) => t?.address?.toLowerCase?.() === prevAddr) ??
        (nextTokens[0] as any);
      return {
        ...prev,
        toNetwork: nextTo as any,
        toToken: matched,
      };
    });
  }, [toNetworks]);

  const [showTokenSelector, setShowTokenSelector] = useState<
    "from" | "to" | null
  >(null);
  const [selectorNetwork, setSelectorNetwork] = useState<Network | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tokenSearch, setTokenSearch] = useState("");
  // no-op swap animation; we no longer flip from/to in UI
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const tokenSelectorRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Helpers to map our network ids to chainIds used by wagmi
  const fromChainId = React.useMemo(() => {
    return (
      SUPPORTED_NETWORKS.find((n) => n.network === swapState.fromNetwork?.id)
        ?.chainId ?? undefined
    );
  }, [swapState.fromNetwork?.id]);
  const toChainId = React.useMemo(() => {
    return (
      SUPPORTED_NETWORKS.find((n) => n.network === swapState.toNetwork?.id)
        ?.chainId ?? undefined
    );
  }, [swapState.toNetwork?.id]);

  // Live balances from connected wallet for selected tokens (ERC-20)
  // We scope reads to the currently selected tokens to avoid spamming RPCs.
  const fromBalance = useBalance({
    address,
    token: swapState.fromToken?.address as `0x${string}`,
    chainId: fromChainId,
    query: {
      enabled: Boolean(
        isConnected && address && fromChainId && swapState.fromToken?.address,
      ),
    },
  });
  const toBalance = useBalance({
    address,
    token: swapState.toToken?.address as `0x${string}`,
    chainId: toChainId,
    query: {
      enabled: Boolean(
        isConnected && address && toChainId && swapState.toToken?.address,
      ),
    },
  });

  // Render-friendly string (trim trailing zeros, keep a few decimals)
  function fmtBalance(v?: string): string {
    if (!v) return "0";
    const [ints, decs = ""] = String(v).split(".");
    const trimmed = decs.replace(/0+$/, "").slice(0, 6); // max 6 decimals
    return trimmed ? `${ints}.${trimmed}` : ints;
  }

  // Compact USD formatting for trade fee; trims trailing zeros and caps decimals
  function fmtTradeFeeUSD(x?: string | number): string {
    if (x == null) return "—";
    const v = typeof x === "string" ? Number.parseFloat(x) : x;
    if (!Number.isFinite(v) || v < 0) return "—";
    if (v === 0) return "~$0.00";
    if (v < 0.01) return "~<$0.01";
    if (v < 1) return `~$${v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
    if (v < 100) return `~$${v.toFixed(2)}`;
    return `~$${Math.round(v)}`;
  }

  // Price loading state for UI feedback when fetching real-time quotes
  const [fromPriceLoading, setFromPriceLoading] = useState(false);
  const [toPriceLoading, setToPriceLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [lastQuoteOut, setLastQuoteOut] = useState<string | null>(null);
  const [lastQuoteMeta, setLastQuoteMeta] = useState<{
    tradeFeeUSD?: string;
    priceImpactPercent?: string;
  } | null>(null);

  // Fetch real-time price for the selected From token
  useEffect(() => {
    let cancelled = false;
    const tokenAddr = swapState.fromToken?.address;
    if (!fromChainId || !tokenAddr) return;
    setFromPriceLoading(true);
    (async () => {
      try {
        const result = await okxGetTokenPrice({
          chainId: fromChainId,
          tokenAddress: tokenAddr,
        });
        if (cancelled) return;
        setSwapState((prev) => ({
          ...prev,
          fromToken: {
            ...prev.fromToken,
            price:
              result && result.price > 0 ? result.price : prev.fromToken.price,
          },
        }));
      } finally {
        if (!cancelled) setFromPriceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromChainId, swapState.fromToken?.address]);

  // Fetch real-time price for the selected To token
  useEffect(() => {
    let cancelled = false;
    const tokenAddr = swapState.toToken?.address;
    if (!toChainId || !tokenAddr) return;
    setToPriceLoading(true);
    (async () => {
      try {
        const result = await okxGetTokenPrice({
          chainId: toChainId,
          tokenAddress: tokenAddr,
        });
        if (cancelled) return;
        setSwapState((prev) => ({
          ...prev,
          toToken: {
            ...prev.toToken,
            price:
              result && result.price > 0 ? result.price : prev.toToken.price,
          },
        }));
      } finally {
        if (!cancelled) setToPriceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toChainId, swapState.toToken?.address]);

  // Fetch live swap quote for the entered amount and selected tokens
  // biome-ignore lint/correctness/useExhaustiveDependencies: <>
  useEffect(() => {
    let cancelled = false;
    const amt = swapState.fromAmount?.trim();
    const fromAddr = swapState.fromToken?.address;
    const toAddr = swapState.toToken?.address;
    if (!fromChainId || !toChainId || !fromAddr || !toAddr) return;
    if (!amt || isNaN(Number(amt)) || Number(amt) <= 0) {
      // Reset when amount is invalid/empty
      setSwapState((prev) => ({ ...prev, toAmount: "" }));
      return;
    }
    setLastQuoteOut(null);
    setLastQuoteMeta(null);
    setQuoteLoading(true);
    (async () => {
      try {
        const decimals = swapState.fromToken?.decimals ?? 18;
        let amountRaw = "0";
        try {
          amountRaw = parseUnits(amt, decimals).toString();
        } catch {
          amountRaw = "0";
        }
        const q = await okxGetQuote({
          chainId: fromChainId,
          tokenIn: fromAddr,
          tokenOut: toAddr,
          amountRaw,
          swapMode: "exactIn",
          // Optional knobs available:
          // priceImpactProtectionPercent: '90',
          // feePercent: '0',
          // directRoute: false,
          slippage: swapState.slippage,
          userAddress: address,
        });
        if (cancelled) return;
        if (q && (q.rawAmountOut || q.amountOut)) {
          // Convert raw out units to decimal string using toToken decimals
          // Prefer decimals from the quote response if present; fallback to known token decimals
          const qToDecRaw = (q as any)?.data?.toToken?.decimal;
          const qToDecimals =
            typeof qToDecRaw === "string" ? Number.parseInt(qToDecRaw, 10) : undefined;
          const toDecimals = Number.isFinite(qToDecimals as number)
            ? (qToDecimals as number)
            : (swapState.toToken?.decimals ?? 18);
          const rawOut = q.rawAmountOut || q.amountOut || "0";
          let display = "0";
          try {
            display = formatUnits(BigInt(rawOut), toDecimals);
          } catch { }
          // trim trailing zeros, keep 6 decimals max
          const [i, d = ""] = display.split(".");
          const t = d.replace(/0+$/, "").slice(0, 6);
          display = t ? `${i}.${t}` : i;
          setLastQuoteOut(display);
          setLastQuoteMeta({
            tradeFeeUSD: q.tradeFeeUSD,
            priceImpactPercent: q.priceImpactPercent,
          });
          setSwapState((prev) => ({ ...prev, toAmount: display }));
        }
      } catch {
        // Silently ignore; the price-ratio effect already filled an estimate
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    fromChainId,
    toChainId,
    swapState.fromToken?.address,
    swapState.toToken?.address,
    swapState.fromAmount,
    swapState.slippage,
    address,
  ]);

  useClickOutside(tokenSelectorRef, () => setShowTokenSelector(null));
  useClickOutside(settingsRef, () => setShowSettings(false));

  // Reset token search when the selector closes
  useEffect(() => {
    if (!showTokenSelector) setTokenSearch("");
  }, [showTokenSelector]);

  // Mouse tracking for glow effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    if (isHovering) {
      document.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isHovering]);

  // Note: The combined effect above replaces the previous 'from-only' reset effect.

  // Calculate fallback estimate ONLY when no fresh quote is available or in-flight
  useEffect(() => {
    const amt = swapState.fromAmount;
    if (quoteLoading || lastQuoteOut != null) return;
    if (amt && !isNaN(Number(amt))) {
      const fromValue = Number(amt) * swapState.fromToken.price;
      const toAmount = (fromValue / swapState.toToken.price).toFixed(6);
      setSwapState((prev) => ({ ...prev, toAmount }));
    } else {
      setSwapState((prev) => ({ ...prev, toAmount: "" }));
    }
  }, [
    swapState.fromAmount,
    swapState.fromToken.price,
    swapState.toToken.price,
    quoteLoading,
    lastQuoteOut,
  ]);

  const handleTokenSelect = (token: Token) => {
    if (showTokenSelector === "from") {
      setSwapState((prev) => ({
        ...prev,
        fromToken: token,
        fromNetwork: selectorNetwork ?? prev.fromNetwork,
      }));
    } else if (showTokenSelector === "to") {
      setSwapState((prev) => ({
        ...prev,
        toToken: token,
        toNetwork: selectorNetwork ?? prev.toNetwork,
      }));
    }
    setShowTokenSelector(null);
    setSelectorNetwork(null);
  };

  // removed token swap toggle; for bridge/swap targets come from hook

  const handleSwap = async () => {
    if (!swapState.fromAmount || Number(swapState.fromAmount) <= 0) return;
    // Require wallet connection for swap/bridge actions
    if (!isConnected) {
      try {
        await appKitModal?.open();
      } catch { }
      return;
    }

    setSwapState((prev) => ({ ...prev, status: "loading", isLoading: true }));

    // Simulate swap transaction
    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      setSwapState((prev) => ({
        ...prev,
        status: "success",
        isLoading: false,
        fromAmount: "",
        toAmount: "",
      }));

      setTimeout(() => {
        setSwapState((prev) => ({ ...prev, status: "idle" }));
      }, 2000);
    } catch (error) {
      setSwapState((prev) => ({
        ...prev,
        status: "error",
        isLoading: false,
        error: "Swap failed. Please try again.",
      }));
    }
  };

  const containerVariants: any = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: any = {
    hidden: { opacity: 0, x: -20, filter: "blur(4px)" },
    visible: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 28,
        mass: 0.6,
      },
    },
  };

  const glowVariants: any = {
    idle: { opacity: 0 },
    hover: {
      opacity: 1,
      transition: { duration: 0.3 },
    },
  };

  return (
    <div className="bg-background flex items-center justify-center p-4">
      <motion.div
        ref={containerRef}
        className="relative w-full max-w-md"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Animated background glow */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-xl"
          variants={glowVariants}
          animate={isHovering ? "hover" : "idle"}
          style={{
            background: isHovering
              ? `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.3) 0%, rgba(147, 51, 234, 0.2) 50%, transparent 70%)`
              : undefined,
          }}
        />

        {/* Main swap container */}
        <motion.div
          className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-6 shadow-2xl"
          variants={itemVariants}
        >
          {/* Header */}
          <motion.div
            className="flex items-center justify-between mb-6"
            variants={itemVariants}
          >
            <div className="flex items-center gap-3">
              <motion.div
                className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <Zap className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {mode === "bridge" ? "Bridge" : "Swap"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {mode === "bridge"
                    ? "Move assets between networks"
                    : "Trade tokens instantly"}
                </p>
              </div>
            </div>

            <motion.button
              className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          </motion.div>

          {/* From Token */}
          <motion.div className="relative mb-2" variants={itemVariants}>
            <div className="bg-muted/30 rounded-2xl p-4 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">From</span>
                <span className="text-sm text-muted-foreground">
                  Balance:{" "}
                  {fmtBalance(fromBalance.data?.formatted) ||
                    swapState.fromToken.balance}
                </span>
              </div>

              <div className="flex items-center gap-3 min-w-0">
                <motion.button
                  className="flex items-start gap-2 bg-background/50 rounded-xl px-3 py-2 hover:bg-background/80 transition-colors shrink-0"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectorNetwork(swapState.fromNetwork);
                    setShowTokenSelector("from");
                  }}
                >
                  <AssetLogo
                    kind="token"
                    id={swapState.fromToken.symbol}
                    size={36}
                    src={swapState.fromToken.logoUrl}
                  />
                  <div className="flex flex-col leading-tight items-start justify-start">
                    <span className="font-semibold">
                      {swapState.fromToken.symbol}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="truncate max-w-[8rem] sm:max-w-[10rem]">
                        {swapState.fromNetwork.name}
                      </span>
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground self-center" />
                </motion.button>

                <input
                  type="number"
                  placeholder="0.0"
                  value={swapState.fromAmount}
                  onChange={(e) =>
                    setSwapState((prev) => ({
                      ...prev,
                      fromAmount: e.target.value,
                    }))
                  }
                  className="min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold outline-none placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground"></span>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  {fromPriceLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Fetching price…</span>
                    </>
                  ) : (
                    <>
                      ≈ $
                      {(
                        Number(swapState.fromAmount || 0) *
                        swapState.fromToken.price
                      ).toFixed(2)}
                    </>
                  )}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Swap Button */}
          <motion.div
            className="flex justify-center -my-1 relative z-10"
            variants={itemVariants}
          >
            <motion.div
              className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <ArrowDown className="w-5 h-5 text-white" />
            </motion.div>
          </motion.div>

          {/* To Token */}
          <motion.div className="relative mb-6" variants={itemVariants}>
            <div className="bg-muted/30 rounded-2xl p-4 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">To</span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  {toLoading && (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading assets…</span>
                    </>
                  )}
                  {!toLoading && (
                    <>
                      Balance:{" "}
                      {fmtBalance(toBalance.data?.formatted) ||
                        swapState.toToken.balance}
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-3 min-w-0">
                <motion.button
                  className={cn(
                    "flex items-start gap-2 bg-background/50 rounded-xl px-3 py-2 transition-colors shrink-0",
                    toLoading
                      ? "opacity-70 cursor-not-allowed"
                      : "hover:bg-background/80",
                  )}
                  whileHover={toLoading ? undefined : { scale: 1.02 }}
                  whileTap={toLoading ? undefined : { scale: 0.98 }}
                  disabled={toLoading}
                  onClick={() => {
                    if (toLoading) return;
                    setSelectorNetwork(swapState.toNetwork);
                    setShowTokenSelector("to");
                  }}
                >
                  <AssetLogo
                    kind="token"
                    id={swapState.toToken.symbol}
                    size={36}
                    src={swapState.toToken.logoUrl}
                  />
                  <div className="flex flex-col leading-tight items-start justify-start">
                    <span className="font-semibold">
                      {swapState.toToken.symbol}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="truncate max-w-[8rem] sm:max-w-[10rem]">
                        {swapState.toNetwork.name}
                      </span>
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground self-center" />
                </motion.button>

                <div className="flex-1 min-w-0 text-right text-2xl font-semibold text-muted-foreground truncate">
                  {quoteLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />—
                    </span>
                  ) : (
                    swapState.toAmount || "0.0"
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground"></span>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  {toPriceLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Fetching price…</span>
                    </>
                  ) : (
                    <>
                      ≈ $
                      {(
                        Number(swapState.toAmount || 0) *
                        swapState.toToken.price
                      ).toFixed(2)}
                    </>
                  )}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Swap Info */}
          {swapState.fromAmount && (
            <motion.div
              className="bg-muted/20 rounded-xl p-3 mb-4 space-y-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rate</span>
                <span className="inline-flex items-center gap-2">
                  {fromPriceLoading || toPriceLoading || quoteLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    <>
                      1 {swapState.fromToken.symbol} ={" "}
                      {(
                        swapState.toToken.price / swapState.fromToken.price
                      ).toFixed(6)}{" "}
                      {swapState.toToken.symbol}
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Slippage</span>
                <span>{swapState.slippage}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trade Fee</span>
                <span className="inline-flex items-center gap-2">
                  {quoteLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Estimating…</span>
                    </>
                  ) : lastQuoteMeta?.tradeFeeUSD ? (
                    <>{fmtTradeFeeUSD(lastQuoteMeta.tradeFeeUSD)}</>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
              </div>
              {/* Price Impact intentionally hidden per product requirement */}
            </motion.div>
          )}

          {/* Swap Button */}
          <motion.button
            className={cn(
              "w-full py-4 rounded-2xl font-semibold text-lg transition-all duration-300",
              swapState.status === "success"
                ? "bg-green-500 text-white"
                : swapState.status === "error"
                  ? "bg-red-500 text-white"
                  : swapState.isLoading
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : !swapState.fromAmount || Number(swapState.fromAmount) <= 0
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700",
            )}
            whileHover={
              !swapState.isLoading && swapState.fromAmount
                ? { scale: 1.02 }
                : {}
            }
            whileTap={
              !swapState.isLoading && swapState.fromAmount
                ? { scale: 0.98 }
                : {}
            }
            disabled={
              swapState.isLoading ||
              !swapState.fromAmount ||
              Number(swapState.fromAmount) <= 0
            }
            onClick={handleSwap}
            variants={itemVariants}
          >
            <div className="flex items-center justify-center gap-2">
              {!isConnected ? (
                <>Connect Wallet</>
              ) : swapState.isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Swapping...
                </>
              ) : swapState.status === "success" ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Swap Successful!
                </>
              ) : swapState.status === "error" ? (
                <>
                  <AlertCircle className="w-5 h-5" />
                  Swap Failed
                </>
              ) : !swapState.fromAmount || Number(swapState.fromAmount) <= 0 ? (
                "Enter an amount"
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Swap Tokens
                </>
              )}
            </div>
          </motion.button>
        </motion.div>

        {/* Token & Network Selector Modal */}
        <AnimatePresence>
          {showTokenSelector && (
            <motion.div
              className="absolute inset-0 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
              <motion.div
                ref={tokenSelectorRef}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-card border border-border rounded-2xl p-5 shadow-2xl"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <h3 className="text-lg font-semibold mb-3">
                  Select Network & Asset
                </h3>
                {/* Search Bar */}
                <div className="mb-3 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search tokens by symbol or name"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    disabled={showTokenSelector === "to" && toLoading}
                  />
                </div>
                {/* Network chips (show loader when fetching to-side assets) */}
                <div className="flex gap-2 mb-3 overflow-x-auto">
                  {showTokenSelector === "to" && toLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Fetching
                      assets…
                    </div>
                  ) : (
                    (showTokenSelector === "from"
                      ? fromNetworks
                      : toNetworks
                    ).map((net) => (
                      <button
                        type="button"
                        key={net.id}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm border",
                          (selectorNetwork?.id ??
                            (showTokenSelector === "from"
                              ? swapState.fromNetwork.id
                              : swapState.toNetwork.id)) === net.id
                            ? "bg-muted text-foreground border-border"
                            : "bg-background text-muted-foreground border-border/50",
                        )}
                        onClick={() => setSelectorNetwork(net)}
                      >
                        <span className="mr-1 inline-flex align-middle">
                          <AssetLogo kind="network" id={net.id} size={16} />
                        </span>
                        <span className="align-middle">{net.name}</span>
                      </button>
                    ))
                  )}
                </div>
                {/* Tokens list */}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {showTokenSelector === "to" && toLoading ? (
                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading
                      tokens…
                    </div>
                  ) : (
                    (
                      selectorNetwork ??
                      (showTokenSelector === "from"
                        ? swapState.fromNetwork
                        : swapState.toNetwork)
                    ).tokens
                      .filter((token) => {
                        const q = tokenSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          token.symbol.toLowerCase().includes(q) ||
                          token.name.toLowerCase().includes(q)
                        );
                      })
                      .map((token, index) => (
                        <motion.button
                          key={token.address}
                          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleTokenSelect(token)}
                        >
                          <AssetLogo
                            kind="token"
                            id={token.symbol}
                            size={36}
                            src={(token as any).logoUrl}
                          />
                          <div className="flex-1 text-left">
                            <div className="font-semibold">{token.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              {token.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{token.balance}</div>
                            {/* Change is not tracked here; omit the delta color bar */}
                          </div>
                        </motion.button>
                      ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              className="absolute inset-0 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
              <motion.div
                ref={settingsRef}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-2xl"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <h3 className="text-lg font-semibold mb-4">Swap Settings</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-2 block">
                      Slippage Tolerance
                    </div>
                    <div className="flex gap-2">
                      {[0.1, 0.5, 1.0].map((value) => (
                        <motion.button
                          key={value}
                          className={cn(
                            "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            swapState.slippage === value
                              ? "bg-blue-500 text-white"
                              : "bg-muted hover:bg-muted/80",
                          )}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            setSwapState((prev) => ({
                              ...prev,
                              slippage: value,
                            }))
                          }
                        >
                          {value}%
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// Public: swap-only component
export function SwapComponent({ networks }: { networks?: Network[] }) {
  return <CryptoSwapBase mode="swap" networks={networks} />;
}

// Public: bridge-only component
export function BridgeComponent({ networks }: { networks?: Network[] }) {
  return <CryptoSwapBase mode="bridge" networks={networks} />;
}
