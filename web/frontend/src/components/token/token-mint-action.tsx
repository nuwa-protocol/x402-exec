import { AlertCircle, CheckCircle2, Hammer, Loader2, Wallet, Zap } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { X402X_MINT_CONFIG } from "@/lib/token-mint-config";

type TokenMintActionProps = {
    isConnected: boolean;
    address?: string;
    error: string | null;
    txHash: string | null;
    isConnecting: boolean;
    isExecuting: boolean;
    isSuccess: boolean;
    usdcAmount: string;
    setUsdcAmount: (value: string) => void;
    estimatedTokens: number | null;
    shortAddress: (addr?: string) => string;
    formattedUsdcBalance: string | null;
    hasInsufficientBalance: boolean;
    buttonDisabled: boolean;
    handlePrimaryAction: () => void;
};

export const TokenMintAction = ({
    isConnected,
    address,
    error,
    txHash,
    isConnecting,
    isExecuting,
    isSuccess,
    usdcAmount,
    setUsdcAmount,
    estimatedTokens,
    shortAddress,
    formattedUsdcBalance,
    hasInsufficientBalance,
    buttonDisabled,
    handlePrimaryAction,
}: TokenMintActionProps) => {
    const MIN_USDC_AMOUNT = 1;
    const MAX_USDC_AMOUNT = 100;
    const PRESET_AMOUNTS = [1, 5, 10, 25, 50, 100] as const;

    const explorerBaseUrl =
        X402X_MINT_CONFIG.chain?.blockExplorers?.default?.url?.replace(/\/$/, "");

    const txExplorerUrl =
        explorerBaseUrl && txHash ? `${explorerBaseUrl}/tx/${txHash}` : undefined;

    const hasInputError = hasInsufficientBalance;

    const numericUsdcAmount = (() => {
        const parsed = Number(usdcAmount);
        if (!Number.isFinite(parsed)) return MIN_USDC_AMOUNT;
        return Math.min(Math.max(parsed, MIN_USDC_AMOUNT), MAX_USDC_AMOUNT);
    })();

    return (
        <div className="p-8 lg:p-12 bg-slate-50/50">
            <div className="h-full flex flex-col">
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex-1 flex flex-col">
                    <div className="mb-6 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Wallet className="text-yellow-500" size={20} />
                            Mint $X402X
                        </h3>
                        {isConnected && (
                            <p className="text-xs sm:text-sm text-slate-400">
                                Connected Wallet:{" "}
                                <span className="font-mono">{shortAddress(address)}</span>
                            </p>
                        )}
                    </div>

                    <div className="space-y-6 flex-1">
                        {/* Input Section */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label
                                    htmlFor="amount"
                                    className="text-xs font-semibold text-slate-600"
                                >
                                    USDC for Minting
                                </label>
                                {isConnected && (
                                    <p className="text-[11px] text-slate-400">
                                        Balance:{" "}
                                        {formattedUsdcBalance != null
                                            ? `${formattedUsdcBalance} USDC`
                                            : "—"}
                                    </p>
                                )}
                            </div>
                            <div
                                className={`rounded-lg border bg-white px-4 py-3 ${hasInputError
                                    ? "border-red-300 ring-1 ring-red-500/30"
                                    : "border-slate-200"
                                    }`}
                            >
                                <div className="mb-3 flex items-baseline justify-between">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold text-slate-900">
                                            {numericUsdcAmount.toFixed(0)}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-500">
                                            USDC
                                        </span>
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <Slider
                                        min={MIN_USDC_AMOUNT}
                                        max={MAX_USDC_AMOUNT}
                                        step={1}
                                        value={[numericUsdcAmount]}
                                        onValueChange={(value) => {
                                            const next = value[0];
                                            if (typeof next === "number") {
                                                setUsdcAmount(String(next));
                                            }
                                        }}
                                    />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {PRESET_AMOUNTS.map((amount) => (
                                        <button
                                            key={amount}
                                            type="button"
                                            onClick={() => setUsdcAmount(String(amount))}
                                            className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${numericUsdcAmount === amount
                                                ? "bg-yellow-500/10 border-yellow-500 text-yellow-700"
                                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                                }`}
                                        >
                                            {amount}U
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {hasInsufficientBalance && (
                                <div className="flex items-center gap-1 mt-2 text-red-500 text-xs">
                                    <AlertCircle size={14} />
                                    <span>Insufficient USDC balance for this mint amount.</span>
                                </div>
                            )}
                        </div>

                        {/* Output Preview */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label
                                    htmlFor="output"
                                    className="text-xs font-semibold text-slate-600"
                                >
                                    You Receive
                                </label>
                                <p className="text-[11px] text-slate-400">
                                    Preview only – final amount depends on on-chain execution
                                </p>
                            </div>
                            <div className="w-full bg-slate-50 border border-slate-200 rounded-lg py-4 px-4 flex justify-between items-center">
                                <span
                                    className={`text-xl font-bold ${estimatedTokens && estimatedTokens > 0
                                        ? "text-emerald-600"
                                        : "text-slate-400"
                                        }`}
                                >
                                    {estimatedTokens && estimatedTokens > 0
                                        ? estimatedTokens.toLocaleString(undefined, {
                                            maximumFractionDigits: 8,
                                        })
                                        : "0.00000000"}
                                </span>
                                <span className="text-slate-500 text-xs font-semibold">
                                    $X402X
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-8">
                        <button
                            type="button"
                            onClick={handlePrimaryAction}
                            disabled={buttonDisabled || hasInsufficientBalance}
                            className={`
                    w-full py-4 rounded-lg font-bold text-sm sm:text-base transition-all transform active:scale-[0.98]
                    flex items-center justify-center gap-2
                    ${isExecuting ||
                                    isConnecting ||
                                    buttonDisabled ||
                                    hasInsufficientBalance
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                    : isSuccess
                                        ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                                        : "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-white shadow-lg shadow-amber-300/40"
                                }
                  `}
                        >
                            {!isConnected ? (
                                isConnecting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Connecting wallet...
                                    </>
                                ) : (
                                    <>
                                        <Wallet size={18} />
                                        Connect wallet
                                    </>
                                )
                            ) : isExecuting ? (
                                <>
                                    <Hammer size={18} className="animate-bounce" />
                                    Executing mint...
                                </>
                            ) : isSuccess ? (
                                <>
                                    <CheckCircle2 size={18} />
                                    Minted!
                                </>
                            ) : (
                                <>
                                    <Zap size={18} />
                                    Mint via x402x
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="flex items-center gap-1 mt-2 text-red-500 text-xs">
                                <AlertCircle size={14} />
                                <span>{error}</span>
                            </div>
                        )}

                        {isSuccess && txHash && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-start gap-2 mt-3">
                                <CheckCircle2
                                    className="text-emerald-500 shrink-0 mt-0.5"
                                    size={16}
                                />
                                <div>
                                    <p className="text-[11px]">
                                        <span className="text-xs font-medium text-emerald-700">
                                            Mint transaction submitted:{" "}
                                        </span>
                                        <span className="text-emerald-600 font-mono">
                                            {txExplorerUrl ? (
                                                <a
                                                    href={txExplorerUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="underline decoration-dotted underline-offset-2 hover:text-emerald-700"
                                                >
                                                    {shortAddress(txHash ?? undefined)}
                                                </a>
                                            ) : (
                                                <span>{shortAddress(txHash ?? undefined)}</span>
                                            )}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
