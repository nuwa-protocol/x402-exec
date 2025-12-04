import { TokenMintAction } from "@/components/token/token-mint-action";
import { TokenMintFooter } from "@/components/token/token-mint-footer";
import { TokenMintHeader } from "@/components/token/token-mint-header";
import { TokenMintProgress } from "@/components/token/token-mint-progress";
import { useTokenMint } from "@/hooks/use-token-mint";
import { calculateBondingCurvePrice } from "@/lib/token-mint";
import { X402X_MINT_CONFIG, X402X_TOKEN_CONFIG } from "@/lib/token-mint-config";
import { useEffect, useMemo, useState } from "react";

export const TokenMint = () => {
    const {
        status,
        isConnected,
        address,
        error,
        txHash,
        mintedTokens,
        currentPrice,
        formattedUsdcBalance,
        hasInsufficientBalance,
        estimateTokensForUsdc,
        connectWallet,
        executeMint,
    } = useTokenMint();

    const [usdcAmount, setUsdcAmount] = useState("10");
    const [isMintEnded, setIsMintEnded] = useState(false);

    const totalAllocation =
        X402X_TOKEN_CONFIG.mintAllocationTokens || 1_000_000_000 / 10;
    const mintedAmount = mintedTokens || 0;
    const percentage = Math.min((mintedAmount / totalAllocation) * 100, 100);

    const effectiveCurrentPrice =
        (currentPrice ??
            calculateBondingCurvePrice(mintedAmount, totalAllocation)) ||
        null;

    const [estimatedTokens, setEstimatedTokens] = useState<number | null>(null);

    // Track whether the mint window has ended based on the configured timestamp.
    useEffect(() => {
        const endTs = X402X_MINT_CONFIG.mintEndTimestamp;
        if (!endTs) return;

        const check = () => {
            setIsMintEnded(Date.now() >= endTs * 1000);
        };

        check();
        const id = window.setInterval(check, 1000);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const v = usdcAmount.trim();
            if (!v) {
                setEstimatedTokens(null);
                return;
            }
            const est = await estimateTokensForUsdc(v);
            if (!cancelled) {
                setEstimatedTokens(est);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [usdcAmount, estimateTokensForUsdc]);

    // Generate bonding-curve data for the chart (0 → total allocation)
    const priceCurveData = useMemo(() => {
        const steps = 50;
        const maxSupply = totalAllocation;
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
    }, [totalAllocation]);

    const maxCurvePrice = useMemo(
        () =>
            priceCurveData.reduce(
                (max, point) => (point.price > max ? point.price : max),
                0,
            ),
        [priceCurveData],
    );

    const chartFillPercent = Number.isFinite(percentage)
        ? Math.max(0, Math.min(percentage, 100))
        : 0;

    const isConnecting = status === "connecting";
    const isExecuting = status === "executing";
    const isSuccess = status === "success";

    const insufficientBalance = hasInsufficientBalance(usdcAmount);

    const buttonDisabled =
        isConnecting ||
        isExecuting ||
        isMintEnded ||
        (isConnected && !usdcAmount.trim());

    const shortAddress = (addr?: string) => {
        if (!addr) return "";
        if (addr.length <= 10) return addr;
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const handlePrimaryAction = () => {
        if (isMintEnded) {
            return;
        }
        if (!isConnected) {
            connectWallet();
            return;
        }
        void executeMint(usdcAmount);
    };

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
                        totalAllocation={totalAllocation}
                        percentage={percentage}
                    />

                    {/* Right Panel: Action Interface (top right) */}
                    <TokenMintAction
                        isConnected={isConnected}
                        address={address}
                        error={error}
                        txHash={txHash}
                        isConnecting={isConnecting}
                        isExecuting={isExecuting}
                        isSuccess={isSuccess}
                        usdcAmount={usdcAmount}
                        setUsdcAmount={setUsdcAmount}
                        estimatedTokens={estimatedTokens}
                        shortAddress={shortAddress}
                        formattedUsdcBalance={formattedUsdcBalance}
                        hasInsufficientBalance={insufficientBalance}
                        buttonDisabled={buttonDisabled}
                        handlePrimaryAction={handlePrimaryAction}
                    />
                </div>
                <TokenMintFooter />
            </div>
        </div>
    );
};
