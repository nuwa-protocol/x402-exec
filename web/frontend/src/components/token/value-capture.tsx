import { Flame, PieChart } from "lucide-react";

export const ValueCapture = () => {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                    <span className="text-yellow-500">$X402X</span> Captues All Values from the Facilitator Fee
                </h2>
                <p className="text-slate-500 max-w-2xl mx-auto">
                    The core value capture mechanism of the $X402X token lies within the design of the facilitator incentive. Facilitator fees are used to buy back and burn $X402X, creating deflationary pressure.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">

                {/* Priority Burn Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 flex flex-col justify-center relative overflow-hidden text-white shadow-lg">
                    {/* Dark card for contrast on important burn metric */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400">
                            <Flame size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white">$X402X Buyback with Facilitator Fee </h3>
                    </div>

                    <div className="text-center py-6">
                        <span className="text-6xl font-black text-white tracking-tighter">100%</span>
                        <p className="text-yellow-400 font-medium mt-2">
                            of all facilitator revenues are used to buyback $X402X
                        </p>
                    </div>

                    <p className="text-slate-400 text-sm text-center">
                        All x402x protocol transactions will automatically execute buybacks of $X402X via the x402x settlement router contract and the liquidity pool contracts.
                    </p>
                </div>


                {/* Fee Split Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
                            <PieChart size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Buyback Tokens Split</h3>
                    </div>
                    <p className="text-slate-500 text-sm mb-6">
                        The tokens bought back with the facilitator fees are splited in 3 ways to drive more value.
                    </p>

                    <div className="space-y-5">
                        <div className="relative">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-slate-700 font-medium text-sm">Burn</span>
                                <span className="text-slate-900 font-bold text-sm">60%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5">
                                <div className="bg-yellow-500 h-2.5 rounded-full" style={{ width: "60%" }} />
                            </div>
                        </div>

                        <div className="relative">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-slate-700 font-medium text-sm">Stakers Reward</span>
                                <span className="text-slate-900 font-bold text-sm">20%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5">
                                <div className="bg-slate-700 h-2.5 rounded-full" style={{ width: "20%" }} />
                            </div>
                        </div>

                        <div className="relative">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-slate-700 font-medium text-sm">Core Contributers</span>
                                <span className="text-slate-900 font-bold text-sm">20%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5">
                                <div className="bg-slate-400 h-2.5 rounded-full" style={{ width: "20%" }} />
                            </div>
                        </div>
                    </div>
                </div>


            </div>
        </div>
    );
};
