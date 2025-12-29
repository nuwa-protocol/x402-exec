import { TokenMintFooter } from "@/components/token/token-mint-footer";
import { TokenMintHeader } from "@/components/token/token-mint-header";
import { TokenMintProgress } from "@/components/token/token-mint-progress";
import { calculateBondingCurvePrice } from "@/lib/token-mint";
import {
    X402X_MINT_CONFIG,
    X402X_MINT_FINALIZATION_CONFIG,
    X402X_TOKEN_CONFIG,
} from "@/lib/token-mint-config";
import { CheckCircle2 } from "lucide-react";
import { useMemo } from "react";

export const TokenMint = () => {
    const { unsoldTokens, unaddedLPTokens, mintTokenBurnTx, lpTokenBurnTx, lpCreateTx } =
        X402X_MINT_FINALIZATION_CONFIG;

    const explorerBaseUrl =
        X402X_MINT_CONFIG.chain?.blockExplorers?.default?.url?.replace(/\/$/, "");

    const txExplorerBaseUrl = explorerBaseUrl
        ? `${explorerBaseUrl}/tx/`
        : undefined;

    const shortTx = (hash?: string) => {
        if (!hash) return "";
        if (hash.length <= 10) return hash;
        return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
    };

    const totalAllocation =
        X402X_TOKEN_CONFIG.mintAllocationTokens || 1_000_000_000 / 10;
    const mintedAmount = Math.max(totalAllocation - unsoldTokens, 0);
    //const percentage = Math.min((mintedAmount / totalAllocation) * 100, 100);

    const effectiveCurrentPrice =
        calculateBondingCurvePrice(mintedAmount, totalAllocation) || null;

    // Generate bonding-curve data for the chart (0 → total sold supply).
    // The curve now ends at the final minted amount instead of the full allocation.
    const priceCurveData = useMemo(() => {
        const steps = 50;
        const maxSupply = mintedAmount;
        if (!maxSupply || !Number.isFinite(maxSupply)) return [];

        const data: { supply: number; price: number }[] = [];
        for (let i = 0; i <= steps; i++) {
            const supply = (maxSupply / steps) * i;
            const price = calculateBondingCurvePrice(supply, totalAllocation);
            data.push({
                supply,
                price,
            });
        }
        return data;
    }, [mintedAmount, totalAllocation]);

    const maxCurvePrice = useMemo(
        () =>
            priceCurveData.reduce(
                (max, point) => (point.price > max ? point.price : max),
                0,
            ),
        [priceCurveData],
    );

    // Since the chart now only covers the sold range [0, mintedAmount],
    // the fill represents 100% of the visible curve once mint is concluded.
    const chartFillPercent = mintedAmount > 0 ? 100 : 0;

    const unsoldTokensLabel = `${(unsoldTokens / 1_000_000).toFixed(1)}M`;
    const unaddedLPTokensLabel = `${(unaddedLPTokens / 1_000_000).toFixed(1)}M`;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <TokenMintHeader />

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                    <TokenMintProgress
                        priceCurveData={priceCurveData}
                        maxCurvePrice={maxCurvePrice}
                        chartFillPercent={chartFillPercent}
                        mintedAmount={mintedAmount}
                        effectiveCurrentPrice={effectiveCurrentPrice}
                    />
                    {/* Right Panel: Final mint information */}
                    <div className="p-8 lg:p-12 bg-slate-50/50">
                        <div className="h-full flex flex-col">
                            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex-1 flex flex-col">
                                <div className="mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="text-emerald-500" size={20} />
                                    <h3 className="text-lg font-bold text-slate-900">
                                        $X402X Initial Token Mint Finalization
                                    </h3>
                                </div>
                                <ul className="space-y-3 text-sm text-slate-700">
                                    <li className="flex flex-col gap-0.5">
                                        <div>
                                            1️⃣ Mint Hook Contract is permanantely closed (no further supply
                                            from this contract)
                                        </div>
                                    </li>
                                    <li className="flex flex-col gap-0.5">
                                        <div>
                                            2️⃣ All unsold tokens from the initial allocation are burned (
                                            {unsoldTokensLabel})
                                        </div>
                                        {mintTokenBurnTx && txExplorerBaseUrl && (
                                            <div className="text-xs text-slate-500 font-mono">
                                                <a
                                                    href={`${txExplorerBaseUrl}${mintTokenBurnTx}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="underline decoration-dotted underline-offset-2 hover:text-slate-700"
                                                >
                                                    See on-chain transaction ({shortTx(mintTokenBurnTx)})
                                                </a>
                                            </div>
                                        )}
                                    </li>
                                    <li className="flex flex-col gap-0.5">
                                        <div>
                                            3️⃣ All additional tokens that are not added to the liquidity pool
                                            are burned ({unaddedLPTokensLabel})
                                        </div>
                                        {lpTokenBurnTx && txExplorerBaseUrl && (
                                            <div className="text-xs text-slate-500 font-mono">
                                                <a
                                                    href={`${txExplorerBaseUrl}${lpTokenBurnTx}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="underline decoration-dotted underline-offset-2 hover:text-slate-700"
                                                >
                                                    See on-chain transaction ({shortTx(lpTokenBurnTx)})
                                                </a>
                                            </div>
                                        )}
                                    </li>
                                    <li className="flex flex-col gap-0.5">
                                        <div>4️⃣ Liquidity Pool is created with 100% funds.</div>
                                        {lpCreateTx && txExplorerBaseUrl && (
                                            <div className="text-xs text-slate-500 font-mono">
                                                <a
                                                    href={`${txExplorerBaseUrl}${lpCreateTx}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="underline decoration-dotted underline-offset-2 hover:text-slate-700"
                                                >
                                                    See on-chain transaction ({shortTx(lpCreateTx)})
                                                </a>
                                            </div>
                                        )}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <TokenMintFooter />
            </div>
        </div>
    );
};
