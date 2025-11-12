'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpDown, 
  Settings, 
  ChevronDown, 
  Zap, 
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Hook for click outside functionality
function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
  mouseEvent: 'mousedown' | 'mouseup' = 'mousedown'
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
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener(mouseEvent, listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, mouseEvent]);
}

interface Token {
  symbol: string;
  name: string;
  icon: string;
  balance: string;
  price: number;
  change24h: number;
  address: string;
}

interface Network {
  id: string;
  name: string;
  icon: string; // emoji or small glyph
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
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
}

const defaultNetworks: Network[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    icon: '⬡',
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ether',
        icon: '⟠',
        balance: '2.5847',
        price: 2340.5,
        change24h: 5.2,
        address: '0x0000000000000000000000000000000000000000'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        icon: '💵',
        balance: '1,250.00',
        price: 1.0,
        change24h: 0.1,
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      },
      {
        symbol: 'UNI',
        name: 'Uniswap',
        icon: '🦄',
        balance: '45.2',
        price: 8.45,
        change24h: -2.1,
        address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'
      }
    ]
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    icon: '🌀',
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ether',
        icon: '⟠',
        balance: '0.8342',
        price: 2340.5,
        change24h: 5.2,
        address: '0x0000000000000000000000000000000000000000'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        icon: '💵',
        balance: '540.12',
        price: 1.0,
        change24h: 0.1,
        address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
      },
      {
        symbol: 'ARB',
        name: 'Arbitrum',
        icon: '🧿',
        balance: '120.5',
        price: 1.2,
        change24h: 3.8,
        address: '0x912ce59144191c1204e64559fe8253a0e49e6548'
      }
    ]
  }
];

type Mode = 'swap' | 'bridge';

// Internal base component used by the SwapComponent and BridgeComponent wrappers.
// Consumers should import/use the specific components instead of a generic "mode" prop.
function CryptoSwapBase({ mode, networks = defaultNetworks }: { mode: Mode; networks?: Network[] }) {
  const initialFromNetwork = networks[0];
  const initialToNetwork = mode === 'bridge' ? (networks[1] ?? networks[0]) : networks[0];
  const [swapState, setSwapState] = useState<SwapState>({
    fromNetwork: initialFromNetwork,
    toNetwork: initialToNetwork,
    fromToken: initialFromNetwork.tokens[0],
    toToken: initialToNetwork.tokens[1] ?? initialToNetwork.tokens[0],
    fromAmount: '',
    toAmount: '',
    slippage: 0.5,
    isLoading: false,
    status: 'idle'
  });

  const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null);
  const [selectorNetwork, setSelectorNetwork] = useState<Network | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
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
          y: e.clientY - rect.top
        });
      }
    };

    if (isHovering) {
      document.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isHovering]);

  // Calculate exchange rate and amounts
  useEffect(() => {
    if (swapState.fromAmount && !isNaN(Number(swapState.fromAmount))) {
      const fromValue = Number(swapState.fromAmount) * swapState.fromToken.price;
      const toAmount = (fromValue / swapState.toToken.price).toFixed(6);
      setSwapState(prev => ({ ...prev, toAmount }));
    } else {
      setSwapState(prev => ({ ...prev, toAmount: '' }));
    }
  }, [swapState.fromAmount, swapState.fromToken.price, swapState.toToken.price]);

  const handleTokenSelect = (token: Token) => {
    if (showTokenSelector === 'from') {
      setSwapState(prev => ({ ...prev, fromToken: token, fromNetwork: selectorNetwork ?? prev.fromNetwork }));
    } else if (showTokenSelector === 'to') {
      setSwapState(prev => ({ ...prev, toToken: token, toNetwork: selectorNetwork ?? prev.toNetwork }));
    }
    setShowTokenSelector(null);
    setSelectorNetwork(null);
  };

  const handleSwapTokens = () => {
    setIsSwapping(true);
    setTimeout(() => {
      setSwapState(prev => ({
        ...prev,
        fromNetwork: prev.toNetwork,
        toNetwork: prev.fromNetwork,
        fromToken: prev.toToken,
        toToken: prev.fromToken,
        fromAmount: prev.toAmount,
        toAmount: prev.fromAmount
      }));
      setIsSwapping(false);
    }, 300);
  };

  const handleSwap = async () => {
    if (!swapState.fromAmount || Number(swapState.fromAmount) <= 0) return;

    setSwapState(prev => ({ ...prev, status: 'loading', isLoading: true }));

    // Simulate swap transaction
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSwapState(prev => ({ 
        ...prev, 
        status: 'success', 
        isLoading: false,
        fromAmount: '',
        toAmount: ''
      }));
      
      setTimeout(() => {
        setSwapState(prev => ({ ...prev, status: 'idle' }));
      }, 2000);
    } catch (error) {
      setSwapState(prev => ({ 
        ...prev, 
        status: 'error', 
        isLoading: false,
        error: 'Swap failed. Please try again.'
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
        type: 'spring',
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, x: -20, filter: 'blur(4px)' },
    visible: {
      opacity: 1,
      x: 0,
      filter: 'blur(0px)',
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 28,
        mass: 0.6
      }
    }
  };

  const glowVariants: any = {
    idle: { opacity: 0 },
    hover: { 
      opacity: 1,
      transition: { duration: 0.3 }
    }
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
          animate={isHovering ? 'hover' : 'idle'}
          style={{
            background: isHovering 
              ? `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.3) 0%, rgba(147, 51, 234, 0.2) 50%, transparent 70%)`
              : undefined
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
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Zap className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{mode === 'bridge' ? 'Bridge' : 'Swap'}</h1>
                <p className="text-sm text-muted-foreground">{mode === 'bridge' ? 'Move assets between networks' : 'Trade tokens instantly'}</p>
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
          <motion.div
            className="relative mb-2"
            variants={itemVariants}
          >
            <div className="bg-muted/30 rounded-2xl p-4 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">From • {swapState.fromNetwork.name}</span>
                <span className="text-sm text-muted-foreground">
                  Balance: {swapState.fromToken.balance}
                </span>
              </div>
              
              <div className="flex items-center gap-3 min-w-0">
                <motion.button
                  className="flex items-center gap-2 bg-background/50 rounded-xl px-3 py-2 hover:bg-background/80 transition-colors shrink-0"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectorNetwork(swapState.fromNetwork); setShowTokenSelector('from'); }}
                >
                  <span className="text-2xl">{swapState.fromToken.icon}</span>
                  <div className="flex flex-col leading-tight">
                    <span className="font-semibold">{swapState.fromToken.symbol}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{swapState.fromNetwork.icon}</span>
                      <span className="truncate max-w-[8rem] sm:max-w-[10rem]">{swapState.fromNetwork.name}</span>
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.button>

                <input
                  type="number"
                  placeholder="0.0"
                  value={swapState.fromAmount}
                  onChange={(e) => setSwapState(prev => ({ ...prev, fromAmount: e.target.value }))}
                  className="min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold outline-none placeholder:text-muted-foreground"
                />
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground">
                  ${swapState.fromToken.price.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  ≈ ${(Number(swapState.fromAmount || 0) * swapState.fromToken.price).toFixed(2)}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Swap Button */}
          <motion.div 
            className="flex justify-center -my-1 relative z-10"
            variants={itemVariants}
          >
            <motion.button
              className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              animate={{ rotate: isSwapping ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={handleSwapTokens}
            >
              <ArrowUpDown className="w-5 h-5 text-white" />
            </motion.button>
          </motion.div>

          {/* To Token */}
          <motion.div
            className="relative mb-6"
            variants={itemVariants}
          >
            <div className="bg-muted/30 rounded-2xl p-4 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">To • {swapState.toNetwork.name}</span>
                <span className="text-sm text-muted-foreground">
                  Balance: {swapState.toToken.balance}
                </span>
              </div>
              
              <div className="flex items-center gap-3 min-w-0">
                <motion.button
                  className="flex items-center gap-2 bg-background/50 rounded-xl px-3 py-2 hover:bg-background/80 transition-colors shrink-0"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectorNetwork(swapState.toNetwork); setShowTokenSelector('to'); }}
                >
                  <span className="text-2xl">{swapState.toToken.icon}</span>
                  <div className="flex flex-col leading-tight">
                    <span className="font-semibold">{swapState.toToken.symbol}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{swapState.toNetwork.icon}</span>
                      <span className="truncate max-w-[8rem] sm:max-w-[10rem]">{swapState.toNetwork.name}</span>
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.button>

                <div className="flex-1 min-w-0 text-right text-2xl font-semibold text-muted-foreground truncate">
                  {swapState.toAmount || '0.0'}
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground">
                  ${swapState.toToken.price.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  ≈ ${(Number(swapState.toAmount || 0) * swapState.toToken.price).toFixed(2)}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Swap Info */}
          {swapState.fromAmount && (
            <motion.div
              className="bg-muted/20 rounded-xl p-3 mb-4 space-y-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rate</span>
                <span>1 {swapState.fromToken.symbol} = {(swapState.toToken.price / swapState.fromToken.price).toFixed(6)} {swapState.toToken.symbol}</span>
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
              swapState.status === 'success' 
                ? "bg-green-500 text-white"
                : swapState.status === 'error'
                ? "bg-red-500 text-white"
                : swapState.isLoading
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : !swapState.fromAmount || Number(swapState.fromAmount) <= 0
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
            )}
            whileHover={!swapState.isLoading && swapState.fromAmount ? { scale: 1.02 } : {}}
            whileTap={!swapState.isLoading && swapState.fromAmount ? { scale: 0.98 } : {}}
            disabled={swapState.isLoading || !swapState.fromAmount || Number(swapState.fromAmount) <= 0}
            onClick={handleSwap}
            variants={itemVariants}
          >
            <div className="flex items-center justify-center gap-2">
              {swapState.isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Swapping...
                </>
              ) : swapState.status === 'success' ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Swap Successful!
                </>
              ) : swapState.status === 'error' ? (
                <>
                  <AlertCircle className="w-5 h-5" />
                  Swap Failed
                </>
              ) : !swapState.fromAmount || Number(swapState.fromAmount) <= 0 ? (
                'Enter an amount'
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
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <h3 className="text-lg font-semibold mb-3">Select Network & Asset</h3>
                <div className="flex gap-2 mb-3 overflow-x-auto">
                  {networks.map((net) => (
                    <button
                      key={net.id}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm border',
                        (selectorNetwork?.id ?? (showTokenSelector === 'from' ? swapState.fromNetwork.id : swapState.toNetwork.id)) === net.id
                          ? 'bg-muted text-foreground border-border'
                          : 'bg-background text-muted-foreground border-border/50'
                      )}
                      onClick={() => setSelectorNetwork(net)}
                    >
                      <span className="mr-1">{net.icon}</span>
                      {net.name}
                    </button>
                  ))}
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(selectorNetwork ?? (showTokenSelector === 'from' ? swapState.fromNetwork : swapState.toNetwork)).tokens.map((token, index) => (
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
                      <span className="text-2xl">{token.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{token.symbol}</div>
                        <div className="text-sm text-muted-foreground">{token.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{token.balance}</div>
                        <div className={cn(
                          "text-sm",
                          token.change24h >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {token.change24h >= 0 ? '+' : ''}{token.change24h}%
                        </div>
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
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <h3 className="text-lg font-semibold mb-4">Swap Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Slippage Tolerance
                    </label>
                    <div className="flex gap-2">
                      {[0.1, 0.5, 1.0].map((value) => (
                        <motion.button
                          key={value}
                          className={cn(
                            "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            swapState.slippage === value
                              ? "bg-blue-500 text-white"
                              : "bg-muted hover:bg-muted/80"
                          )}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSwapState(prev => ({ ...prev, slippage: value }))}
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
export function SwapComponent({ networks = defaultNetworks }: { networks?: Network[] }) {
  return <CryptoSwapBase mode="swap" networks={networks} />;
}

// Public: bridge-only component
export function BridgeComponent({ networks = defaultNetworks }: { networks?: Network[] }) {
  return <CryptoSwapBase mode="bridge" networks={networks} />;
}
