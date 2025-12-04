import { useTokenAppKit } from "@/components/token/token-appkit-provider";
import { X402X_MINT_CONFIG, X402X_TOKEN_CONFIG } from "@/lib/token-mint-config";
import { Wallet } from "lucide-react";
import { useWatchAsset } from "wagmi";

export const TokenMintFooter = () => {
    const { isConnected, openModal } = useTokenAppKit();
    const { watchAssetAsync, isPending } = useWatchAsset();

    const explorerBaseUrl =
        X402X_MINT_CONFIG.chain?.blockExplorers?.default?.url?.replace(/\/$/, "");

    const mintExplorerUrl = explorerBaseUrl
        ? `${explorerBaseUrl}/address/${X402X_MINT_CONFIG.address}`
        : undefined;

    const tokenExplorerUrl = explorerBaseUrl
        ? `${explorerBaseUrl}/address/${X402X_TOKEN_CONFIG.address}`
        : undefined;

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
            <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-start">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-4 text-sm font-mono">
                        <div className="break-all">
                            <span className="text-slate-500">Mint Hook: </span>
                            {mintExplorerUrl ? (
                                <a
                                    href={mintExplorerUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-slate-900 underline decoration-dotted underline-offset-2 hover:text-slate-700"
                                >
                                    {X402X_MINT_CONFIG.address}
                                </a>
                            ) : (
                                <span className="text-slate-900">
                                    {X402X_MINT_CONFIG.address}
                                </span>
                            )}
                        </div>
                        <div className="break-all">
                            <span className="text-slate-500">$X402X Contract: </span>
                            {tokenExplorerUrl ? (
                                <a
                                    href={tokenExplorerUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-slate-900 underline decoration-dotted underline-offset-2 hover:text-slate-700"
                                >
                                    {X402X_TOKEN_CONFIG.address}
                                </a>
                            ) : (
                                <span className="text-slate-900">
                                    {X402X_TOKEN_CONFIG.address}
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="text-sm whitespace-nowrap">
                        The $X402X token&apos;s liquidity pool has not been created yet. It will be
                        deployed and seeded after the initial token mint concludes.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleAddToken}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 text-sm font-medium text-yellow-600 hover:text-yellow-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Wallet size={14} />
                    {isPending ? "Adding token…" : "Add to wallet"}
                </button>
            </div>
        </div>
    );
};
