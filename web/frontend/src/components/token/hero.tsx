import { Coins, ShieldCheck, Zap } from "lucide-react";

export const Hero = () => {
    return (
        <div className="relative overflow-hidden bg-white">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative z-10 text-center">
                <div className="inline-block px-3 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-semibold uppercase tracking-wide mb-8">
                    The Native Token for x402x Protocol
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-slate-900">
                    <span className="text-yellow-500">$X402X</span> Tokenomics
                </h1>

                <p className="mt-4 max-w-2xl mx-auto text-xl text-slate-600 leading-relaxed font-light">
                    An x402 ecosystem value capture asset designed to
                    power the next generation of Gas-Less, Cross-Chain infrastructure.
                </p>

                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4 mx-auto text-yellow-600 group-hover:scale-110 transition-transform">
                            <ShieldCheck size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-1">Facilitator Fee</h3>
                        <p className="text-slate-500 font-medium text-sm">$X402X captures the value of revenue from the facilitator fees earned by the ecosystem facilitator.</p>
                    </div>

                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4 mx-auto text-yellow-600 group-hover:scale-110 transition-transform">
                            <Zap size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-1">Fair Mint</h3>
                        <p className="text-slate-500 font-medium text-sm">No Pre-Mine. No Private Sale. No Inflation. The only way to get the tokens are via x402 payments based ecosystem participation.</p>
                    </div>

                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4 mx-auto text-yellow-600 group-hover:scale-110 transition-transform">
                            <Coins size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-1">x402-to-Earn</h3>
                        <p className="text-slate-500 font-medium text-sm">Every single x402 payment across the ecosystem DApps will get rewarded with $X402X tokens as part of the contribution of participating in the ecosystem. </p>
                    </div>
                </div>
            </div>
        </div>
    );
};