import { X402X_MINT_CONFIG } from "@/lib/token-mint-config";
import { useEffect, useState } from "react";

type TimeRemaining = {
    totalMs: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
};

function getTimeRemaining(endTimestamp: number | null): TimeRemaining | null {
    if (!endTimestamp) return null;

    const totalMs = endTimestamp * 1000 - Date.now();
    const clampedMs = Math.max(totalMs, 0);

    const totalSeconds = Math.floor(clampedMs / 1000);
    const days = Math.floor(totalSeconds / (60 * 60 * 24));
    const hours = Math.floor((totalSeconds / (60 * 60)) % 24);
    const minutes = Math.floor((totalSeconds / 60) % 60);
    const seconds = totalSeconds % 60;

    return {
        totalMs: clampedMs,
        days,
        hours,
        minutes,
        seconds,
    };
}

export const TokenMintHeader = () => {
    const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(() =>
        getTimeRemaining(X402X_MINT_CONFIG.mintEndTimestamp),
    );

    useEffect(() => {
        if (!X402X_MINT_CONFIG.mintEndTimestamp) return;

        const update = () => {
            setTimeRemaining(getTimeRemaining(X402X_MINT_CONFIG.mintEndTimestamp));
        };

        update();
        const id = window.setInterval(update, 1000);
        return () => window.clearInterval(id);
    }, []);

    const hasCountdown = !!timeRemaining;
    const mintEnded = !!timeRemaining && timeRemaining.totalMs === 0;

    return (
        <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 border border-green-200 text-green-700 text-xs font-semibold uppercase tracking-wide mb-4">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span>{mintEnded ? "Mint Concluded" : "Minting Live"}</span>
                {hasCountdown && !mintEnded && timeRemaining && (
                    <>
                    <span className="tracking-tight">ends in</span>
                        <span className="font-mono tracking-tight">
                            {timeRemaining.days > 0 ? `${timeRemaining.days}d ` : null}
                            {timeRemaining.hours.toString().padStart(2, "0")}:
                            {timeRemaining.minutes.toString().padStart(2, "0")}:
                            {timeRemaining.seconds.toString().padStart(2, "0")}
                        </span>
                        
                    </>
                )}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                <span className="text-yellow-500">$X402X</span> Initial Token Mint
            </h2>
            {hasCountdown && mintEnded && (
                <p className="text-sm text-slate-500">
                    The initial token mint has concluded. Liquidity will follow after settlement.
                </p>
            )}
        </div>
    );
};
