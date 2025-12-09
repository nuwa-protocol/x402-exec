import { useScanStats } from "@/hooks/use-scan-stats";
import { animate } from "motion";
import { useEffect, useRef, useState } from "react";

// Pretty-print a number with K/M/B suffix and return { value, suffix, decimals }
function formatWithSuffix(n: number): { value: number; suffix: string; decimals: number } {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return { value: n / 1_000_000_000, suffix: "B", decimals: 2 };
  if (abs >= 1_000_000) return { value: n / 1_000_000, suffix: "M", decimals: 2 };
  if (abs >= 1_000) return { value: n / 1_000, suffix: "K", decimals: 1 };
  return { value: n, suffix: "", decimals: 0 };
}

export function CountUpStats() {
  const { stats, loading } = useScanStats({});

  // Use the same aggregated stats source as the /activities page
  const totalUsd = stats.transactionVolumeUsd ?? 0;
  const { value: usdcVal, suffix: usdcSuf, decimals: usdcDec } = formatWithSuffix(totalUsd);

  const uniquePayers = stats.accountsCount ?? 0;
  const { value: payersVal, suffix: payersSuf, decimals: payersDec } = formatWithSuffix(uniquePayers);

  const txs = stats.transactionsCount ?? 0;
  const { value: txVal, suffix: txSuf, decimals: txDec } = formatWithSuffix(txs);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <div className="flex flex-col items-center justify-center sm:flex-row">
        <Stat num={loading ? 0 : usdcVal} suffix={`${usdcSuf}+`} decimals={usdcDec} subheading="Total Value Transferred (USDC)" />
        <div className="h-[1px] w-12 bg-indigo-200 sm:h-12 sm:w-[1px]" />
        <Stat num={loading ? 0 : payersVal} suffix={`${payersSuf}+`} decimals={payersDec} subheading="Unique Payers" />
        <div className="h-[1px] w-12 bg-indigo-200 sm:h-12 sm:w-[1px]" />
        <Stat num={loading ? 0 : txVal} suffix={`${txSuf}+`} decimals={txDec} subheading="Transactions Settled" />
      </div>
    </div>
  );
}

interface Props {
  num: number;
  suffix: string;
  decimals?: number;
  subheading: string;
}

function Stat({ num, suffix, decimals = 0, subheading }: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  // Minimal in-view observer
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            break;
          }
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, num, {
      duration: 1.8,
      onUpdate(value) {
        if (!ref.current) return;
        ref.current.textContent = value.toFixed(decimals);
      },
    });
    return () => controls?.stop();
  }, [num, decimals, inView]);

  return (
    <div ref={containerRef} className="flex w-72 flex-col items-center py-8 sm:py-0">
      <p className="mb-2 text-center text-6xl font-semibold sm:text-5xl">
        <span ref={ref} />
        {suffix}
      </p>
      <p className="max-w-48 text-center text-neutral-600">{subheading}</p>
    </div>
  );
}

export default CountUpStats;
