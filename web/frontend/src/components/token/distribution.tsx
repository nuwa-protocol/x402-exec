
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipProps } from "recharts";

const data = [
    { name: "x402-to-Earn", value: 80, color: "#eab308" }, // Yellow 500
    { name: "Initial x402 Token Mint", value: 10, color: "#0f172a" }, // Slate 900
    { name: "Initial Token Liquidity", value: 10, color: "#94a3b8" }, // Slate 400
];

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
        const firstPayload = payload[0];
        if (firstPayload && firstPayload.value !== undefined) {
            return (
                <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-lg">
                    <p className="font-semibold text-slate-900 text-sm">{firstPayload.name}</p>
                    <p className="text-yellow-600 font-bold text-lg">{firstPayload.value}%</p>
                    <p className="text-xs text-slate-500">
                        {((firstPayload.value / 100) * 1000000000).toLocaleString()} X402X
                    </p>
                </div>
            );
        }
    }
    return null;
};

export const Distribution = () => {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Fairly Mint and Distributed</h2>
                <p className="text-slate-500 max-w-2xl mx-auto">
                    A simple and balanced allocation designed to incentivize participation, development, and long-term
                    ecosystem growth. No Pre-Mine. No Private Sale. No Inflation.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Chart Side */}
                <div className="h-[400px] w-full bg-slate-50 rounded-2xl border border-slate-200 p-4 relative shadow-sm">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <text
                                x="50%"
                                y={24}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="fill-slate-900 text-2xl font-semibold tracking-tight"
                            >
                                Token Distributions
                            </text>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={130}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {data.map((entry) => (
                                    <Cell key={`cell-${entry.name}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                        <p className="text-4xl font-bold text-slate-900">1B</p>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                            Total Supply
                        </p>
                    </div>
                </div>

                {/* Details Side */}
                <div className="space-y-8">
                    <div className="p-5 rounded-lg bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-3 h-3 rounded-full bg-yellow-500" />
                            <h4 className="font-bold text-slate-900">x402-to-Earn - 80%</h4>
                        </div>
                        <p className=" text-slate-500 leading-relaxed">
                            Major amount of the $X402X tokens will be distributed to the community supporters and ecosystem contributors via the x402-to-earn mechanism.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-5 rounded-lg bg-white border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-3 h-3 rounded-full bg-slate-500" />
                                <h4 className="font-bold text-slate-900">Initial Token Mint - 10%</h4>
                            </div>
                            <p className=" text-slate-500 leading-relaxed">
                                10% of the total supply will be offered via the x402x based token mint event. All funds goes directly from the token minting contract to the liquidity pool.
                            </p>
                        </div>
                        <div className="p-5 rounded-lg bg-white border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-3 h-3 rounded-full bg-slate-400" />
                                <h4 className="font-bold text-slate-900">Initial Token Liquidity - 10%</h4>
                            </div>
                            <p className=" text-slate-500 leading-relaxed">
                                10% of the total supply tokens will be allocated to the liquidity pool for boosting the initial liquidity for the $X402X token, upon the launch of the $X402X tokens.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
