"use client";

import AssetLogo from "@/components/asset-logo";
import {
  SUPPORTED_NETWORKS,
  SUPPORTED_PAYMENT_TOKENS,
} from "@/constants/networks";
import { useNetworkMode } from "@/contexts/NetworkModeContext";
import { useTargetAssets } from "@/hooks/use-target-assets";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDown,
  CheckCircle,
  ChevronDown,
  Loader2,
  Settings,
  Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
// Wallet connection guard: use wagmi account state + AppKit modal
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";

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
  balance: string;
  price: number;
  change24h: number;
  address: string;
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

// Build networks from the SDK's supported list. We currently expose USDC per network.
function buildNetworksFromSDK(mode: "mainnet" | "testnet"): Network[] {
  return SUPPORTED_NETWORKS.filter((n) =>
    mode === "mainnet" ? n.status === "Mainnet" : n.status === "Testnet",
  ).map((n) => {
    const tokens = (SUPPORTED_PAYMENT_TOKENS[n.network] ?? []).map(
      (t): Token => ({
        symbol: t.symbol,
        name: t.label ?? t.symbol,
        balance: "0",
        price: t.symbol.toUpperCase() === "USDC" ? 1 : 1, // default to 1; pricing is out of scope here
        change24h: 0,
        address: t.address,
      }),
    );
    // Remove the word "Mainnet" from display name when showing
    const displayName =
      n.status === "Mainnet" ? n.name.replace(/\s*Mainnet\b/i, "") : n.name;
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
  const { isConnected } = useAccount();
  // open() will trigger the connect modal when wallet is not connected
  const { open } = useAppKit?.() ?? { open: undefined } as any;
  const { mode: netMode } = useNetworkMode();
  // Memoize fromNetworks so effects don't retrigger on every render
  const fromNetworks = React.useMemo(
    () =>
      networks && networks.length > 0
        ? networks
        : buildNetworksFromSDK(netMode),
    [networks, netMode],
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
  const { networks: toNetworks } = useTargetAssets({
    mode,
    fromNetworkId: swapState.fromNetwork?.id,
    networkMode: netMode,
  });

  // Initialize or reconcile the From side when the available from-networks list changes
  // Keep the user's manual selection intact if still valid; only reset if invalid or empty
  useEffect(() => {
    const nextFrom = fromNetworks?.[0];
    if (!nextFrom) return;
    setSwapState((prev) => {
      const stillValid = fromNetworks.some((n) => n.id === prev.fromNetwork?.id);
      if (stillValid) return prev;
      return {
        ...prev,
        fromNetwork: nextFrom,
        fromToken: nextFrom.tokens[0],
      };
    });
  }, [fromNetworks]);

  // Initialize or reconcile the To side whenever its candidate list changes
  // Keep the user's manual selection intact if still valid; only reset if invalid or empty
  useEffect(() => {
    const nextTo = toNetworks?.[0];
    if (!nextTo) return;
    setSwapState((prev) => {
      const stillValid = (toNetworks ?? []).some((n) => n.id === prev.toNetwork?.id);
      if (stillValid) return prev;
      return {
        ...prev,
        toNetwork: nextTo as any,
        toToken: nextTo.tokens[0] as any,
        toAmount: "",
      };
    });
  }, [toNetworks]);

  const [showTokenSelector, setShowTokenSelector] = useState<
    "from" | "to" | null
  >(null);
  const [selectorNetwork, setSelectorNetwork] = useState<Network | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  // no-op swap animation; we no longer flip from/to in UI
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const tokenSelectorRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useClickOutside(tokenSelectorRef, () => setShowTokenSelector(null));
  useClickOutside(settingsRef, () => setShowSettings(false));

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

  // Calculate exchange rate and amounts
  useEffect(() => {
    if (swapState.fromAmount && !isNaN(Number(swapState.fromAmount))) {
      const fromValue =
        Number(swapState.fromAmount) * swapState.fromToken.price;
      const toAmount = (fromValue / swapState.toToken.price).toFixed(6);
      setSwapState((prev) => ({ ...prev, toAmount }));
    } else {
      setSwapState((prev) => ({ ...prev, toAmount: "" }));
    }
  }, [
    swapState.fromAmount,
    swapState.fromToken.price,
    swapState.toToken.price,
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
        await open?.();
      } catch {}
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
                  Balance: {swapState.fromToken.balance}
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
                  />
                  <div className="flex flex-col leading-tight items-start justify-start">
                    <span className="font-semibold">
                      {swapState.fromToken.symbol}
                    </span>
                    <span className="text-xs text-muted-foreground flex gap-1">
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
                <span className="text-xs text-muted-foreground">
                  ≈ $
                  {(
                    Number(swapState.fromAmount || 0) *
                    swapState.fromToken.price
                  ).toFixed(2)}
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
                <span className="text-sm text-muted-foreground">
                  Balance: {swapState.toToken.balance}
                </span>
              </div>

              <div className="flex items-center gap-3 min-w-0">
                <motion.button
                  className="flex items-start gap-2 bg-background/50 rounded-xl px-3 py-2 hover:bg-background/80 transition-colors shrink-0"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectorNetwork(swapState.toNetwork);
                    setShowTokenSelector("to");
                  }}
                >
                  <AssetLogo
                    kind="token"
                    id={swapState.toToken.symbol}
                    size={36}
                  />
                  <div className="flex flex-col leading-tight items-start justify-start">
                    <span className="font-semibold">
                      {swapState.toToken.symbol}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="truncate max-w-[8rem] sm:max-w-[10rem]">
                        {swapState.toNetwork.name}
                      </span>
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground self-center" />
                </motion.button>

                <div className="flex-1 min-w-0 text-right text-2xl font-semibold text-muted-foreground truncate">
                  {swapState.toAmount || "0.0"}
                </div>
              </div>

              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground"></span>
                <span className="text-xs text-muted-foreground">
                  ≈ $
                  {(
                    Number(swapState.toAmount || 0) * swapState.toToken.price
                  ).toFixed(2)}
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
                <span>
                  1 {swapState.fromToken.symbol} ={" "}
                  {(
                    swapState.toToken.price / swapState.fromToken.price
                  ).toFixed(6)}{" "}
                  {swapState.toToken.symbol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Slippage</span>
                <span>{swapState.slippage}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Network Fee</span>
                <span>~$2.50</span>
              </div>
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
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-2xl"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <h3 className="text-lg font-semibold mb-3">
                  Select Network & Asset
                </h3>
                <div className="flex gap-2 mb-3 overflow-x-auto">
                  {(showTokenSelector === "from"
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
                  ))}
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(
                    selectorNetwork ??
                    (showTokenSelector === "from"
                      ? swapState.fromNetwork
                      : swapState.toNetwork)
                  ).tokens.map((token, index) => (
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
                      <AssetLogo kind="token" id={token.symbol} size={36} />
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
                  ))}
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
