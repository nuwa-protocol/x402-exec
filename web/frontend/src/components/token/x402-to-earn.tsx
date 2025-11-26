import { Globe, Repeat, Server, Users, Wallet, Zap } from "lucide-react";

export const X402ToEarn = () => {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-5">
                    <div className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-700 mb-4">
                        Ecosystem Incentive & Flywheel
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-6">x402-to-Earn</h2>

                    <p className="text-slate-600 mb-6 leading-relaxed">
                        x402-to-Earn is a participation-driven distribution model: Every verified x402x payment execution on-chain will automatically trigger the minting for the payer. Any project developers or users will be benefited from the growth of the x402x facilitator ecosystem.
                    </p>
                    <div className="p-6 bg-white border border-yellow-100 rounded-xl mb-8 shadow-sm">
                        <p className="text-lg font-semibold text-slate-900 italic border-l-4 border-yellow-500 pl-4">
                            "Who invokes, who earns."
                        </p>
                        <p className="text-sm text-slate-500 mt-4 pl-5">
                            This guarantees a decentralized, transparent, and fair distribution of the token
                            supply based on actual utility.
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-7">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                        Rewardable Action Examples
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            {
                                icon: <Zap className="text-amber-500" size={20} />,
                                title: "x402 + DeFi",
                                desc: "Making a gas-less swap, powered by the x402x facilitator.",
                            },
                            {
                                icon: <Server className="text-purple-500" size={20} />,
                                title: "x402 + GameFi",
                                desc: "Joining a game by making a stable coin only payment.",
                            },
                            {
                                icon: <Globe className="text-sky-500" size={20} />,
                                title: "x402 + AI",
                                desc: "Building pay-per-use AI services.",
                            },
                            {
                                icon: <Repeat className="text-emerald-500" size={20} />,
                                title: "x402 + Prediction Markets",
                                desc: "Make a gas-free bet on your favorite market.",
                            },
                            {
                                icon: <Wallet className="text-indigo-500" size={20} />,
                                title: "x402 + Account Abstraction",
                                desc: "Session keys, batched calls, and trustless automation for smart accounts.",
                            },
                            {
                                icon: <Users className="text-rose-500" size={20} />,
                                title: "x402 + Social Payments",
                                desc: "Rewarding creators, DAOs, and communities with instant revenue shares.",
                            },
                        ].map((item) => (
                            <div
                                key={item.title}
                                className="flex items-start gap-4 p-5 rounded-xl bg-white border border-slate-200 hover:border-yellow-400 hover:shadow-md transition-all group shadow-sm"
                            >
                                <div className="mt-1 group-hover:scale-110 transition-transform p-2 bg-slate-50 rounded-lg group-hover:bg-yellow-50">
                                    {item.icon}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};