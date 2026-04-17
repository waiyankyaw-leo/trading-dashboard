import { type IPriceLine, type UTCTimestamp } from "lightweight-charts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTickerStore } from "@/store/tickerStore";
import type { OHLCVBar, Tick } from "@/types";
import { InstrumentIcon } from "@/components/ui/InstrumentIcon";
import { Bell, Trash2 } from "lucide-react";
import { useAlerts } from "@/hooks/useAlerts";
import { useChartSetup } from "./hooks/useChartSetup";
import { useAlertLines } from "./hooks/useAlertLines";
import { ChartLegend } from "./ChartLegend";
import { ChartContextMenu } from "./ChartContextMenu";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { formatPrice, formatTimestamp } from "@/lib/formatters";
import type { CandleData, Legend } from "./chartTypes";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

const INTERVAL_MS: Record<string, number> = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
};

interface LiveTick {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
}

interface PriceChartProps {
    symbol: string;
    name: string;
    history: OHLCVBar[];
    interval: string;
    onIntervalChange: (iv: string) => void;
    liveTick?: LiveTick;
    onSetAlert?: (alertId: string, symbol: string, above?: number, below?: number) => void;
    onRemoveAlert?: (alertId: string) => void;
}

export function PriceChart({ symbol, name, history, interval, onIntervalChange, liveTick, onSetAlert, onRemoveAlert }: PriceChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastCandleRef = useRef<CandleData | null>(null);
    const liveBarRef = useRef<CandleData | null>(null);
    const lastProcessedTickTsRef = useRef(0);
    const chartBuffer = useTickerStore(useShallow((s) => s.chartBuffers[symbol] ?? []));
    const chartBufferRef = useRef(chartBuffer);
    chartBufferRef.current = chartBuffer;
    const { data: alerts = [] } = useAlerts(symbol);
    const intervalMs = INTERVAL_MS[interval] ?? 60_000;
    const intervalSec = intervalMs / 1000;
    const isCrypto = symbol.includes("-");
    const [legend, setLegend] = useState<Legend | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; price: number } | null>(null);

    const updateLegendFromBar = useCallback((bar: CandleData) => {
        setLegend({
            time: formatTimestamp(bar.time),
            open: formatPrice(bar.open, isCrypto),
            high: formatPrice(bar.high, isCrypto),
            low: formatPrice(bar.low, isCrypto),
            close: formatPrice(bar.close, isCrypto),
            isUp: bar.close >= bar.open,
        });
    }, [isCrypto]);

    const handleCrosshair = useCallback((candle: CandleData | null) => {
        if (candle) {
            setLegend({
                time: formatTimestamp(candle.time),
                open: formatPrice(candle.open, isCrypto),
                high: formatPrice(candle.high, isCrypto),
                low: formatPrice(candle.low, isCrypto),
                close: formatPrice(candle.close, isCrypto),
                isUp: candle.close >= candle.open,
            });
        } else if (lastCandleRef.current) {
            updateLegendFromBar(lastCandleRef.current);
        }
    }, [isCrypto, updateLegendFromBar]);

    // Indirection ref — allows onRangeChange to call recalcAlertYs which is defined after useChartSetup
    const onRangeChangeRef = useRef<() => void>(() => { });
    const alertLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());

    const { chartRef, candleSeriesRef, isViewMoved, setIsViewMoved, defaultRangeRef, hasFittedRef, resetView } =
        useChartSetup(containerRef, {
            symbol,
            alertLinesRef: alertLinesMapRef,
            onCrosshairMove: handleCrosshair,
            onRangeChange: () => onRangeChangeRef.current(),
        });

    const applyBufferedTicks = useCallback((ticks: Tick[]) => {
        const series = candleSeriesRef.current;
        if (!series || ticks.length === 0) return;
        let nextBar = liveBarRef.current;
        for (const tick of ticks) {
            lastProcessedTickTsRef.current = Math.max(lastProcessedTickTsRef.current, tick.ts);
            const bucketTime = (Math.floor(tick.ts / intervalMs) * intervalSec) as UTCTimestamp;
            const prevBar = nextBar;
            if (!prevBar || bucketTime > prevBar.time) {
                nextBar = { time: bucketTime, open: tick.price, high: tick.price, low: tick.price, close: tick.price };
            } else if (bucketTime < prevBar.time) {
                continue;
            } else {
                nextBar = { ...prevBar, high: Math.max(prevBar.high, tick.price), low: Math.min(prevBar.low, tick.price), close: tick.price };
            }
            liveBarRef.current = nextBar;
            lastCandleRef.current = nextBar;
            series.update(nextBar);
        }
        if (nextBar) updateLegendFromBar(nextBar);
    }, [candleSeriesRef, intervalMs, intervalSec, updateLegendFromBar]);

    const {
        alertYMap,
        recalcAlertYs,
        draggingAlertId,
        confirmDelete,
        setConfirmDelete,
        isDeletingAlert,
        openDeleteConfirm,
        handleAddAlert,
        handleDeleteAlert,
        handleMouseDown,
    } = useAlertLines({ symbol, alerts, candleSeriesRef, chartRef, containerRef, liveTick, onSetAlert, onRemoveAlert, alertLinesRef: alertLinesMapRef });

    // Wire recalcAlertYs into the range-change indirection ref (runs every render — intentional)
    onRangeChangeRef.current = recalcAlertYs;

    // Reset per-render state when symbol or interval changes
    useEffect(() => {
        hasFittedRef.current = false;
        defaultRangeRef.current = null;
        setIsViewMoved(false);
        setContextMenu(null);
        liveBarRef.current = null;
        lastProcessedTickTsRef.current = 0;
    }, [history, interval, hasFittedRef, defaultRangeRef, setIsViewMoved]);

    // Effect 1: Load history snapshot
    useEffect(() => {
        if (!candleSeriesRef.current) return;
        const candleMap = new Map<UTCTimestamp, CandleData>();
        for (const b of history) {
            const t = (Math.floor(b.ts / intervalMs) * intervalSec) as UTCTimestamp;
            const existing = candleMap.get(t);
            if (!existing) {
                candleMap.set(t, { time: t, open: b.open, high: b.high, low: b.low, close: b.close });
            } else {
                existing.high = Math.max(existing.high, b.high);
                existing.low = Math.min(existing.low, b.low);
                existing.close = b.close;
            }
        }
        const candles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
        const last = candles[candles.length - 1];
        if (last) {
            lastCandleRef.current = last;
            liveBarRef.current = { ...last };
            updateLegendFromBar(last);
        }
        candleSeriesRef.current.setData(candles);
        lastProcessedTickTsRef.current = history[history.length - 1]?.lastUpdateTs ?? 0;
        applyBufferedTicks(chartBufferRef.current.filter((tick) => tick.ts > lastProcessedTickTsRef.current));
        recalcAlertYs();
        if (!hasFittedRef.current && candles.length > 0) {
            const range = { from: Math.max(0, candles.length - 150), to: candles.length - 1 + 2 };
            chartRef.current?.timeScale().setVisibleLogicalRange(range);
            defaultRangeRef.current = range;
            setIsViewMoved(false);
            hasFittedRef.current = true;
        }
    }, [history, intervalMs, intervalSec, applyBufferedTicks, recalcAlertYs, updateLegendFromBar, candleSeriesRef, chartRef, hasFittedRef, defaultRangeRef, setIsViewMoved]);

    // Effect 2: Live tick updates
    useEffect(() => {
        if (!candleSeriesRef.current || chartBuffer.length === 0) return;
        applyBufferedTicks(chartBuffer.filter((tick) => tick.ts > lastProcessedTickTsRef.current));
    }, [applyBufferedTicks, chartBuffer, candleSeriesRef]);

    // Alt+R to reset chart view (same shortcut as TradingView)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && (e.key === "r" || e.key === "R") && isViewMoved) resetView();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isViewMoved, resetView]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const series = candleSeriesRef.current;
        const container = containerRef.current;
        let price = 0;
        if (series && container) {
            const rect = container.getBoundingClientRect();
            const p = series.coordinateToPrice(e.clientY - rect.top);
            if (p !== null) price = Number(p);
        }
        setContextMenu({ x: e.clientX, y: e.clientY, price });
    };

    const isUp = (liveTick?.change ?? 0) >= 0;

    return (
        <div
            className="relative w-full h-full border-r border-gray-800 overflow-hidden"
            style={{ minHeight: 0, cursor: draggingAlertId ? "ns-resize" : "default" }}
            onContextMenu={handleContextMenu}
            onMouseDown={handleMouseDown}
            onClick={() => setContextMenu(null)}
        >
            <ChartContextMenu
                contextMenu={contextMenu}
                onAddAlert={(price) => { void handleAddAlert(price); setContextMenu(null); }}
                onResetView={() => { resetView(); setContextMenu(null); }}
                isViewMoved={isViewMoved}
                isCrypto={isCrypto}
            />

            {/* Always-visible alert line labels */}
            {Object.entries(alertYMap).map(([alertId, y]) => {
                const alert = alerts.find((a) => a.id === alertId);
                if (!alert) return null;
                const price = alert.above ?? alert.below ?? 0;
                const label = `${symbol.replace("-", "")} Crossing ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                const isDragging = draggingAlertId === alertId;
                return (
                    <div
                        key={alertId}
                        className="absolute z-20 pointer-events-none select-none -translate-x-1/2"
                        style={{ top: y - 12, left: "50%" }}
                    >
                        <div className={`flex items-center gap-2 rounded border px-2.5 py-0.5 text-[11px] font-mono shadow backdrop-blur-sm ${isDragging ? "border-orange-400/70 bg-[#0f172a]/95 text-orange-400" : "border-[#facc15]/60 bg-[#0f172a]/90 text-[#facc15]"}`}>
                            <Bell size={11} className="shrink-0" />
                            <span>{label}</span>
                            <button
                                type="button"
                                data-alert-action="open-delete"
                                className="pointer-events-auto text-[#facc15]/70 hover:text-red-400 transition-colors leading-none cursor-pointer"
                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onClick={(e) => openDeleteConfirm(e, alertId, label)}
                            >
                                <Trash2 size={11} />
                            </button>
                        </div>
                    </div>
                );
            })}

            <DeleteConfirmModal
                confirmDelete={confirmDelete}
                isDeletingAlert={isDeletingAlert}
                onConfirm={() => void handleDeleteAlert()}
                onCancel={() => { if (!isDeletingAlert) setConfirmDelete(null); }}
            />

            {/* Header overlay: symbol info + interval selector */}
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[560px] flex-col gap-2 select-none">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2 shadow-[0_14px_40px_rgba(2,6,23,0.3)] backdrop-blur-md">
                    <InstrumentIcon symbol={symbol} size="md" />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-100">{name}</span>
                            <span className="rounded-full border border-slate-700/80 bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {symbol}
                            </span>
                        </div>
                        {liveTick && (
                            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span className="font-mono text-2xl font-semibold tracking-tight text-white">
                                    ${formatPrice(liveTick.price, isCrypto)}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isUp ? "bg-emerald-500/12 text-emerald-300" : "bg-rose-500/12 text-rose-300"}`}>
                                    {isUp ? "+" : ""}{formatPrice(liveTick.change, isCrypto)} ({isUp ? "+" : ""}{liveTick.changePercent.toFixed(2)}%)
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="pointer-events-auto flex w-fit items-center gap-1 rounded-xl border border-slate-800/70 bg-slate-950/70 p-1 backdrop-blur-md">
                    {INTERVALS.map((iv) => (
                        <button
                            key={iv}
                            onClick={() => onIntervalChange(iv)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${interval === iv ? "bg-blue-500 text-white shadow-[0_0_0_1px_rgba(96,165,250,0.3)]" : "text-slate-400 hover:bg-slate-800/70 hover:text-white"}`}
                        >
                            {iv}
                        </button>
                    ))}
                </div>
            </div>

            <ChartLegend legend={legend} />
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
}

