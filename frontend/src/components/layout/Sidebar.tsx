import { useTickerStore } from "@/store/tickerStore";
import { TickerRow } from "@/components/ticker/TickerRow";
import type { TickerSummary } from "@/types";

interface SidebarProps {
    tickers: TickerSummary[];
}

export function Sidebar({ tickers }: SidebarProps) {
    const selectedSymbol = useTickerStore((s) => s.selectedSymbol);
    const setSelectedSymbol = useTickerStore((s) => s.setSelectedSymbol);

    return (
        <aside className="w-full h-full bg-gray-900 border-l border-gray-800 overflow-y-auto flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800 shrink-0">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    Instruments
                </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
                {tickers.map((ticker) => (
                    <TickerRow
                        key={ticker.symbol}
                        ticker={ticker}
                        isSelected={ticker.symbol === selectedSymbol}
                        onSelect={() => setSelectedSymbol(ticker.symbol)}
                    />
                ))}
            </div>
        </aside>
    );
}
