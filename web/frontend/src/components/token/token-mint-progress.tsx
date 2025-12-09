import { Cpu } from "lucide-react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceDot,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type PriceCurvePoint = {
    supply: number;
    price: number;
};

type TokenMintProgressProps = {
    priceCurveData: PriceCurvePoint[];
    maxCurvePrice: number;
    chartFillPercent: number;
    mintedAmount: number;
    effectiveCurrentPrice: number | null;
};

export const TokenMintProgress = ({
    priceCurveData,
    maxCurvePrice,
    chartFillPercent,
    mintedAmount,
    effectiveCurrentPrice,
}: TokenMintProgressProps) => {
    return (
        <div className="p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Cpu size={20} className="text-slate-400" />
                Mint Summary
            </h3>

            <div className="space-y-8">
                {/* Top: Bonding Curve */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-2">
                        Price Curve (Bonding Curve)
                    </p>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={priceCurveData}
                                margin={{
                                    top: 10,
                                    right: 24,
                                    left: 0,
                                    bottom: 4,
                                }}
                            >
                                <defs>
                                    {/* Progress-based gradient fill (0 → minted %) */}
                                    <linearGradient
                                        id="bondingSplitColor"
                                        x1="0"
                                        y1="0"
                                        x2="1"
                                        y2="0"
                                    >
                                        <stop
                                            offset={`${chartFillPercent}%`}
                                            stopColor="#F59E0B"
                                            stopOpacity={0.35}
                                        />
                                        <stop
                                            offset={`${chartFillPercent}%`}
                                            stopColor="#F59E0B"
                                            stopOpacity={0.05}
                                        />
                                    </linearGradient>

                                    <linearGradient
                                        id="bondingStrokeColor"
                                        x1="0"
                                        y1="0"
                                        x2="1"
                                        y2="0"
                                    >
                                        <stop
                                            offset={`${chartFillPercent}%`}
                                            stopColor="#F59E0B"
                                            stopOpacity={1}
                                        />
                                        <stop
                                            offset={`${chartFillPercent}%`}
                                            stopColor="#F59E0B"
                                            stopOpacity={0.3}
                                        />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />

                                <XAxis
                                    dataKey="supply"
                                    tickFormatter={(value: number) =>
                                        `${(value / 1_000_000).toFixed(0)}M`
                                    }
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={11}
                                />

                                <YAxis
                                    tickFormatter={(value: number) =>
                                        `$${value.toFixed(4)}`
                                    }
                                    tickLine={false}
                                    axisLine={false}
                                    width={60}
                                    fontSize={11}
                                    domain={[0, maxCurvePrice * 1.1 || 1]}
                                />

                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#ffffff",
                                        borderColor: "#E5E7EB",
                                        color: "#111827",
                                    }}
                                    formatter={(value: any, name: string) => [
                                        name === "price"
                                            ? `$${Number(value).toFixed(5)}`
                                            : value,
                                        name === "price" ? "Price (USDC)" : "Supply",
                                    ]}
                                    labelFormatter={(label: any) =>
                                        `Minted ${(Number(label) / 1_000_000).toFixed(
                                            2,
                                        )}M X402X`
                                    }
                                />

                                <Area
                                    type="monotone"
                                    dataKey="price"
                                    stroke="url(#bondingStrokeColor)"
                                    strokeWidth={2}
                                    fill="url(#bondingSplitColor)"
                                    animationDuration={800}
                                />

                                {mintedAmount > 0 && effectiveCurrentPrice && (
                                    <>
                                        <ReferenceLine
                                            x={mintedAmount}
                                            stroke="#F97316"
                                            strokeDasharray="3 3"
                                            label={{
                                                position: "top",
                                                value: "Current",
                                                fill: "#F97316",
                                                fontSize: 10,
                                                dy: -4,
                                            }}
                                        />
                                        <ReferenceDot
                                            x={mintedAmount}
                                            y={effectiveCurrentPrice}
                                            r={4}
                                            fill="#F97316"
                                            stroke="#ffffff"
                                            strokeWidth={2}
                                        />
                                    </>
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
};
