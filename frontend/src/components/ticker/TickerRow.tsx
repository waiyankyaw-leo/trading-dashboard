import { clsx } from "clsx";
import { useTickerStore } from "@/store/tickerStore";
import type { TickerSummary } from "@/types";
import { InstrumentIcon } from "@/components/ui/InstrumentIcon";

interface TickerRowProps {
    ticker: TickerSummary;
    isSelected: boolean;
    onSelect: () => void;
}

export function TickerRow({ ticker, isSelected, onSelect }: TickerRowProps) {
    const liveTick = useTickerStore((s) => s.livePrices[ticker.symbol]);

    const price = liveTick?.price ?? ticker.price;
    const change = liveTick?.change ?? 0;
    const changePercent = liveTick?.changePercent ?? 0;
    const isUp = change >= 0;
    const isCrypto = ticker.symbol.includes("-");

    const formatPrice = (p: number) => {
        if (isCrypto)
            return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return p.toFixed(2);
    };

    return (
        <button
            onClick={onSelect}
            className={clsx(
                "w-full border-b border-gray-800/60 px-3 py-3 text-left transition-all",
                isSelected
                    ? "bg-slate-800/75 shadow-[inset_3px_0_0_#3b82f6]"
                    : "hover:bg-slate-800/40",
            )}
        >
            <div className="flex items-center gap-3">
                <InstrumentIcon symbol={ticker.symbol} size="md" />

                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold leading-tight text-white">
                        {ticker.name}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                        <span
                            className={clsx(
                                "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                                isUp ? "bg-green-500" : "bg-red-500",
                            )}
                        />
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                            {ticker.symbol}
                        </span>
                    </div>
                </div>

                <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-white">
                        ${formatPrice(price)}
                    </div>
                    <div
                        className={clsx(
                            "text-xs font-medium",
                            isUp ? "text-green-400" : "text-red-400",
                        )}
                    >
                        {isUp ? "↑" : "↓"} {Math.abs(changePercent).toFixed(2)}%
                    </div>
                </div>
            </div>
        </button>
    );
}
