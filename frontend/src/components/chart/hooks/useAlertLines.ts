import { useCallback, useEffect, useRef, useState } from "react";
import { LineStyle, type IChartApi, type IPriceLine, type ISeriesApi } from "lightweight-charts";
import { useQueryClient } from "@tanstack/react-query";
import {
    alertsQueryKey,
    removeAlertsFromCache,
    useCreateAlertMutation,
    useDeleteAlertMutation,
    useUpdateAlertMutation,
} from "@/hooks/useAlerts";
import { useTickerStore } from "@/store/tickerStore";
import { CHART_THEME } from "@/lib/chartTheme";
import type { PriceAlert } from "@/types";

interface LiveTick {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
}

interface UseAlertLinesOptions {
    symbol: string;
    alerts: PriceAlert[];
    candleSeriesRef: React.MutableRefObject<ISeriesApi<"Candlestick"> | null>;
    chartRef: React.MutableRefObject<IChartApi | null>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    liveTick?: LiveTick;
    onSetAlert?: (alertId: string, symbol: string, above?: number, below?: number) => void;
    onRemoveAlert?: (alertId: string) => void;
    /** Shared Map instance — also held by useChartSetup so it can clear on chart recreation. */
    alertLinesRef: React.MutableRefObject<Map<string, IPriceLine>>;
}

export function useAlertLines({
    symbol,
    alerts,
    candleSeriesRef,
    chartRef,
    containerRef,
    liveTick,
    onSetAlert,
    onRemoveAlert,
    alertLinesRef,
}: UseAlertLinesOptions) {
    const queryClient = useQueryClient();
    const triggeredAlertIds = useTickerStore((s) => s.triggeredAlertIds);
    const consumeTriggeredAlerts = useTickerStore((s) => s.consumeTriggeredAlerts);
    const createAlertMutation = useCreateAlertMutation();
    const updateAlertMutation = useUpdateAlertMutation();
    const deleteAlertMutation = useDeleteAlertMutation();

    const alertsRef = useRef<PriceAlert[]>([]);
    alertsRef.current = alerts;
    const draggingRef = useRef<{ alertId: string; startPrice: number } | null>(null);

    const [alertYMap, setAlertYMap] = useState<Record<string, number>>({});
    const [draggingAlertId, setDraggingAlertId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ alertId: string; label: string } | null>(null);
    const [isDeletingAlert, setIsDeletingAlert] = useState(false);

    const recalcAlertYs = useCallback(() => {
        const series = candleSeriesRef.current;
        if (!series) return;
        const map: Record<string, number> = {};
        for (const alert of alertsRef.current) {
            const price = alert.above ?? alert.below ?? 0;
            const y = series.priceToCoordinate(price);
            if (y !== null) map[alert.id] = Number(y);
        }
        setAlertYMap(map);
    }, [candleSeriesRef]);

    // Remove triggered WS alert lines immediately
    useEffect(() => {
        if (triggeredAlertIds.length === 0) return;
        const alertIds = Array.from(new Set(triggeredAlertIds));
        void queryClient.cancelQueries({ queryKey: alertsQueryKey });
        removeAlertsFromCache(queryClient, alertIds);
        for (const alertId of alertIds) {
            const line = alertLinesRef.current.get(alertId);
            if (!line) continue;
            try {
                candleSeriesRef.current?.removePriceLine(line);
                alertLinesRef.current.delete(alertId);
            } catch { /* keep ref for retry */ }
        }
        setAlertYMap((prev) => {
            const next = { ...prev };
            for (const alertId of alertIds) delete next[alertId];
            return next;
        });
        consumeTriggeredAlerts(alertIds);
    }, [consumeTriggeredAlerts, queryClient, triggeredAlertIds, candleSeriesRef, alertLinesRef]);

    // Sync alert price lines with current alerts array
    useEffect(() => {
        const series = candleSeriesRef.current;
        if (!series) return;
        const existingIds = new Set(alertLinesRef.current.keys());
        const currentIds = new Set(alerts.map((a) => a.id));
        for (const id of existingIds) {
            if (!currentIds.has(id)) {
                const line = alertLinesRef.current.get(id);
                try {
                    if (line) series.removePriceLine(line);
                    alertLinesRef.current.delete(id);
                } catch { /* keep ref for retry */ }
            }
        }
        for (const alert of alerts) {
            if (!alertLinesRef.current.has(alert.id)) {
                const price = alert.above ?? alert.below ?? 0;
                const line = series.createPriceLine({
                    price,
                    color: CHART_THEME.alertLine,
                    lineWidth: 1,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: `Alert ${price.toFixed(2)}`,
                    axisLabelColor: CHART_THEME.alertLine,
                    axisLabelTextColor: "#000",
                });
                alertLinesRef.current.set(alert.id, line);
            }
        }
        recalcAlertYs();
    }, [alerts, recalcAlertYs, candleSeriesRef, alertLinesRef]);

    // Highlight the line being dragged
    useEffect(() => {
        for (const [id, line] of alertLinesRef.current) {
            line.applyOptions({
                color: id === draggingAlertId ? CHART_THEME.alertDrag : CHART_THEME.alertLine,
                lineWidth: id === draggingAlertId ? 2 : 1,
            });
        }
    }, [draggingAlertId, alertLinesRef]);

    // Mouse drag to reposition alert lines
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!draggingRef.current) return;
            const series = candleSeriesRef.current;
            const container = containerRef.current;
            if (!series || !container) return;
            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const newPrice = series.coordinateToPrice(y);
            if (newPrice === null) return;
            const price = Number(newPrice);
            const line = alertLinesRef.current.get(draggingRef.current.alertId);
            if (line) line.applyOptions({ price, title: `Alert ${price.toFixed(2)}` });
            setAlertYMap((prev) => ({ ...prev, [draggingRef.current!.alertId]: y }));
        };

        const handleMouseUp = async (e: MouseEvent) => {
            if (!draggingRef.current) return;
            const { alertId } = draggingRef.current;
            draggingRef.current = null;
            chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
            setDraggingAlertId(null);
            const series = candleSeriesRef.current;
            const container = containerRef.current;
            if (!series || !container) return;
            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const newPrice = series.coordinateToPrice(y);
            if (newPrice === null) return;
            const price = Number(newPrice);
            const alert = alertsRef.current.find((a) => a.id === alertId);
            if (!alert) return;
            const isAbove = alert.above !== null;
            try {
                await updateAlertMutation.mutateAsync({
                    alertId,
                    payload: isAbove ? { above: price } : { below: price },
                });
                onSetAlert?.(alertId, symbol, isAbove ? price : undefined, !isAbove ? price : undefined);
            } catch {
                const origPrice = alert.above ?? alert.below ?? 0;
                const line = alertLinesRef.current.get(alertId);
                line?.applyOptions({ price: origPrice, title: `Alert ${origPrice.toFixed(2)}` });
                recalcAlertYs();
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [symbol, onSetAlert, onRemoveAlert, recalcAlertYs, updateAlertMutation, candleSeriesRef, chartRef, containerRef, alertLinesRef]);

    const handleAddAlert = useCallback(async (price: number) => {
        try {
            const isAbove = liveTick ? price > liveTick.price : true;
            const payload = isAbove ? { symbol, above: price } : { symbol, below: price };
            const created = await createAlertMutation.mutateAsync(payload);
            onSetAlert?.(created.id, symbol, isAbove ? price : undefined, !isAbove ? price : undefined);
        } catch { /* silent */ }
    }, [symbol, liveTick, onSetAlert, createAlertMutation]);

    const handleDeleteAlert = useCallback(async () => {
        if (!confirmDelete || isDeletingAlert) return;
        setIsDeletingAlert(true);
        try {
            await deleteAlertMutation.mutateAsync(confirmDelete.alertId);
        } catch {
            setIsDeletingAlert(false);
            return;
        }
        onRemoveAlert?.(confirmDelete.alertId);
        setAlertYMap((prev) => {
            const next = { ...prev };
            delete next[confirmDelete.alertId];
            return next;
        });
        setConfirmDelete(null);
        setIsDeletingAlert(false);
    }, [confirmDelete, deleteAlertMutation, isDeletingAlert, onRemoveAlert]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("[data-alert-action]")) return;
        const series = candleSeriesRef.current;
        const container = containerRef.current;
        if (!series || !container) return;
        const rect = container.getBoundingClientRect();
        const clientY = e.clientY - rect.top;
        let hitAlertId: string | null = null;
        for (const alert of alertsRef.current) {
            const price = alert.above ?? alert.below ?? 0;
            const lineY = series.priceToCoordinate(price);
            if (lineY !== null && Math.abs(clientY - Number(lineY)) <= 8) {
                hitAlertId = alert.id;
                break;
            }
        }
        if (!hitAlertId) return;
        const alert = alertsRef.current.find((a) => a.id === hitAlertId);
        if (!alert) return;
        draggingRef.current = { alertId: hitAlertId, startPrice: alert.above ?? alert.below ?? 0 };
        setDraggingAlertId(hitAlertId);
        chartRef.current?.applyOptions({ handleScroll: false, handleScale: false });
        e.preventDefault();
    }, [candleSeriesRef, chartRef, containerRef]);

    const openDeleteConfirm = useCallback((e: React.MouseEvent<HTMLButtonElement>, alertId: string, label: string) => {
        e.preventDefault();
        e.stopPropagation();
        draggingRef.current = null;
        setDraggingAlertId(null);
        chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
        setConfirmDelete({ alertId, label });
    }, [chartRef]);

    return {
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
    };
}
