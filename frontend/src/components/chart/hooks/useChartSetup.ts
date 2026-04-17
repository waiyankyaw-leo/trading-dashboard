import { useCallback, useEffect, useRef, useState } from "react";
import {
    createChart,
    CandlestickSeries,
    ColorType,
    CrosshairMode,
    LineStyle,
    type IChartApi,
    type ISeriesApi,
    type IPriceLine,
    type UTCTimestamp,
} from "lightweight-charts";
import { CHART_THEME } from "@/lib/chartTheme";
import type { CandleData } from "../chartTypes";

interface UseChartSetupOptions {
    /** Re-creates the chart when symbol changes. */
    symbol: string;
    /** Ref to the alert lines Map — cleared on chart recreation so lines resync cleanly. */
    alertLinesRef: React.MutableRefObject<Map<string, IPriceLine>>;
    /** Called with the hovered candle, or null when crosshair leaves the chart. */
    onCrosshairMove: (candle: CandleData | null) => void;
    /** Called whenever the visible time range changes (use to recalc alert label positions). */
    onRangeChange: () => void;
}

export function useChartSetup(
    containerRef: React.RefObject<HTMLDivElement | null>,
    options: UseChartSetupOptions,
) {
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const [isViewMoved, setIsViewMoved] = useState(false);
    const defaultRangeRef = useRef<{ from: number; to: number } | null>(null);
    const hasFittedRef = useRef(false);

    // Stable callback refs so the effect closure always calls the latest version
    const onCrosshairMoveRef = useRef(options.onCrosshairMove);
    onCrosshairMoveRef.current = options.onCrosshairMove;
    const onRangeChangeRef = useRef(options.onRangeChange);
    onRangeChangeRef.current = options.onRangeChange;

    const resetView = useCallback(() => {
        if (!defaultRangeRef.current) return;
        chartRef.current?.timeScale().setVisibleLogicalRange(defaultRangeRef.current);
        setIsViewMoved(false);
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: CHART_THEME.bg },
                textColor: CHART_THEME.text,
            },
            grid: {
                vertLines: { color: CHART_THEME.surface },
                horzLines: { color: CHART_THEME.surface },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { color: CHART_THEME.crosshair, labelBackgroundColor: CHART_THEME.surface },
                horzLine: { color: CHART_THEME.crosshair, labelBackgroundColor: CHART_THEME.surface },
            },
            rightPriceScale: { borderColor: CHART_THEME.surface },
            timeScale: { borderColor: CHART_THEME.surface, timeVisible: true, secondsVisible: false },
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight || window.innerHeight - 56,
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: CHART_THEME.gain,
            downColor: CHART_THEME.loss,
            borderVisible: false,
            wickUpColor: CHART_THEME.gain,
            wickDownColor: CHART_THEME.loss,
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineWidth: 1,
            priceLineColor: CHART_THEME.priceLine,
            priceLineStyle: LineStyle.Dashed,
        });

        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.seriesData) {
                onCrosshairMoveRef.current(null);
                return;
            }
            const candle = param.seriesData.get(candleSeries) as (CandleData & { value?: number }) | undefined;
            if (!candle) return;
            onCrosshairMoveRef.current({
                time: param.time as UTCTimestamp,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            });
        });

        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            if (!range || !defaultRangeRef.current) return;
            const def = defaultRangeRef.current;
            const moved = Math.abs(range.from - def.from) > 1 || Math.abs(range.to - def.to) > 1;
            setIsViewMoved(moved);
            onRangeChangeRef.current();
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;

        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                chart.applyOptions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });
        ro.observe(containerRef.current);

        // Capture so cleanup always operates on the right instances
        const alertLinesRef = options.alertLinesRef;

        return () => {
            ro.disconnect();
            chart.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            // Clear stale line refs so they get redrawn on the new chart
            alertLinesRef.current.clear();
        };
    }, [options.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

    return { chartRef, candleSeriesRef, isViewMoved, setIsViewMoved, defaultRangeRef, hasFittedRef, resetView };
}
