export const TokenMintHeader = () => {
    return (
        <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold uppercase tracking-wide mb-4">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                    ✓
                </span>
                <span>Mint Concluded</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                <span className="text-yellow-500">$X402X</span> Initial Token Mint
            </h2>
        </div>
    );
};
