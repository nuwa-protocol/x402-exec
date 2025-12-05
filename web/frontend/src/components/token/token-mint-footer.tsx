import { useTokenAppKit } from "@/components/token/token-appkit-provider";
import {
    X402X_MINT_CONFIG,
    X402X_MINT_FINALIZATION_CONFIG,
    X402X_TOKEN_CONFIG,
} from "@/lib/token-mint-config";
import { Wallet } from "lucide-react";
import { useWatchAsset } from "wagmi";

export const TokenMintFooter = () => {
    const { isConnected, openModal } = useTokenAppKit();
    const { watchAssetAsync, isPending } = useWatchAsset();

    const explorerBaseUrl =
        X402X_MINT_CONFIG.chain?.blockExplorers?.default?.url?.replace(/\/$/, "");

    const tokenExplorerUrl = explorerBaseUrl
        ? `${explorerBaseUrl}/address/${X402X_TOKEN_CONFIG.address}`
        : undefined;

    const lpUrl = X402X_MINT_FINALIZATION_CONFIG.lpUrl;
    const lpAddress = X402X_MINT_FINALIZATION_CONFIG.lpAddress;

    const shortAddress = (value: string) => {
        if (!value) return "";
        if (value.length <= 10) return value;
        return `${value.slice(0, 6)}...${value.slice(-4)}`;
    };

    const handleAddToken = async () => {
        // Prompt user to connect wallet first if needed.
        if (!isConnected) {
            openModal();
            return;
        }

        try {
            await watchAssetAsync({
                type: "ERC20",
                options: {
                    address: X402X_TOKEN_CONFIG.address,
                    decimals: X402X_TOKEN_CONFIG.decimals,
                    symbol: X402X_TOKEN_CONFIG.symbol,
                },
            });
        } catch (error) {
            // Non-fatal: user may reject the request or wallet may not support it.
            // eslint-disable-next-line no-console
            console.error("Failed to add X402X token to wallet", error);
        }
    };

    return (
        <div className="border-t border-slate-100 bg-slate-50 px-8 lg:px-12 py-6">
            <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
                <div className="flex flex-row flex-wrap gap-4 text-sm font-mono">
                    <div className="whitespace-nowrap">
                        <span className="text-slate-500">$X402X Contract: </span>
                        {tokenExplorerUrl ? (
                            <a
                                href={tokenExplorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-900 underline decoration-dotted underline-offset-2 hover:text-slate-700"
                                title={X402X_TOKEN_CONFIG.address}
                            >
                                {shortAddress(X402X_TOKEN_CONFIG.address)}
                            </a>
                        ) : (
                            <span className="text-slate-900">
                                {shortAddress(X402X_TOKEN_CONFIG.address)}
                            </span>
                        )}
                    </div>
                    <div className="whitespace-nowrap">
                        <span className="text-slate-500">$X402X / USDC Liquidity Pool: </span>
                        <a
                            href={lpUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-900 underline decoration-dotted underline-offset-2 hover:text-slate-700"
                            title={lpAddress}
                        >
                            {shortAddress(lpAddress)}
                        </a>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleAddToken}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 text-sm font-medium text-yellow-600 hover:text-yellow-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Wallet size={14} />
                    {isPending ? "Adding token..." : "Add to wallet"}
                </button>
            </div>
        </div>
    );
};
