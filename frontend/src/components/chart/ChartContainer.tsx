import { useState } from "react";
import { useTickerStore } from "@/store/tickerStore";
import { PriceChart } from "./PriceChart";
import { useHistory } from "@/hooks/useTickerData";
import { Spinner } from "@/components/ui/Spinner";
import { ChartErrorBoundary } from "@/components/ui/ChartErrorBoundary";

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const LIMIT_MAP: Record<Interval, number> = {
    "1m": 480,   // 8 hours of 1-min bars
    "5m": 288,   // 24 hours of 5-min bars
    "15m": 192,  // 2 days of 15-min bars
    "1h": 168,   // 1 week of hourly bars
    "4h": 180,   // 1 month of 4h bars
    "1d": 365,   // 1 year of daily bars
};

interface ChartContainerProps {
    onSetAlert?: (alertId: string, symbol: string, above?: number, below?: number) => void;
    onRemoveAlert?: (alertId: string) => void;
}

export function ChartContainer({ onSetAlert, onRemoveAlert }: ChartContainerProps) {
    const selectedSymbol = useTickerStore((s) => s.selectedSymbol);
    const liveTick = useTickerStore((s) => s.livePrices[selectedSymbol]);
    const tickers = useTickerStore((s) => s.tickers);
    const [interval, setInterval] = useState<Interval>("1d");
    const { data: history, isLoading } = useHistory(selectedSymbol, interval, LIMIT_MAP[interval]);

    const ticker = tickers.find((t) => t.symbol === selectedSymbol);
    const name = ticker?.name ?? selectedSymbol;

    return (
        <div className="flex-1 overflow-hidden">
            {isLoading ? (
                <div className="h-full flex items-center justify-center border border-gray-800">
                    <Spinner />
                </div>
            ) : (
                <ChartErrorBoundary>
                    <PriceChart
                        symbol={selectedSymbol}
                        name={name}
                        history={history ?? []}
                        interval={interval}
                        onIntervalChange={(iv) => setInterval(iv as Interval)}
                        liveTick={liveTick}
                        onSetAlert={onSetAlert}
                        onRemoveAlert={onRemoveAlert}
                    />
                </ChartErrorBoundary>
            )}
        </div>
    );
}

