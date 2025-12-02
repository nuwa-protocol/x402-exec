import { X402X_MINT_CONFIG, X402X_TOKEN_CONFIG } from "@/lib/token-mint-config";
import { ArrowDown } from "lucide-react";

type TokenMintFooterProps = {
    onLearnMore?: () => void;
};

export const TokenMintFooter = ({ onLearnMore }: TokenMintFooterProps) => {
    const explorerBaseUrl =
        X402X_MINT_CONFIG.chain?.blockExplorers?.default?.url?.replace(/\/$/, "");

    const mintExplorerUrl = explorerBaseUrl
        ? `${explorerBaseUrl}/address/${X402X_MINT_CONFIG.address}`
        : undefined;

    const tokenExplorerUrl = explorerBaseUrl
        ? `${explorerBaseUrl}/address/${X402X_TOKEN_CONFIG.address}`
        : undefined;

    return (
        <div className="border-t border-slate-100 bg-slate-50 px-8 lg:px-12 py-6">
            <div className=" flex flex-row justify-between items-start">
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
                        <span className="text-slate-500">Token Contract: </span>
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
                {onLearnMore && (
                    <button
                        type="button"
                        onClick={onLearnMore}
                        className="inline-flex items-center gap-1 text-sm font-medium text-yellow-600 hover:text-yellow-700"
                    >
                        Learn more
                        <ArrowDown size="12" />
                    </button>
                )}
            </div>
        </div>
    );
};
