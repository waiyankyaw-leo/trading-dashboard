import { create } from "zustand";
import type { Tick, TickerSummary } from "../types";

export interface AlertNotification {
    id: string;
    message: string;
    symbol?: string;
    price?: number;
    ts: number;
    read: boolean;
}

interface TickerState {
    tickers: TickerSummary[];
    selectedSymbol: string;
    livePrices: Record<string, Tick>;
    chartBuffers: Record<string, Tick[]>;
    alerts: string[];
    notifications: AlertNotification[];
    triggeredAlertIds: string[];

    setTickers: (tickers: TickerSummary[]) => void;
    setSelectedSymbol: (symbol: string) => void;
    applyTick: (tick: Tick) => void;
    applySnapshot: (symbol: string, ticks: Tick[]) => void;
    addAlert: (message: string) => void;
    dismissAlert: (index: number) => void;
    addNotification: (n: Omit<AlertNotification, "id" | "ts" | "read">) => void;
    markAllNotificationsRead: () => void;
    clearNotifications: () => void;
    markAlertTriggered: (alertId: string) => void;
    consumeTriggeredAlerts: (alertIds: string[]) => void;
}

const CHART_BUFFER_SIZE = 120;

export const useTickerStore = create<TickerState>((set) => ({
    tickers: [],
    selectedSymbol: "AAPL",
    livePrices: {},
    chartBuffers: {},
    alerts: [],
    notifications: [],
    triggeredAlertIds: [],

    setTickers: (tickers) => set({ tickers }),

    setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

    applyTick: (tick) =>
        set((state) => {
            const prevBuffer = state.chartBuffers[tick.symbol] ?? [];
            const nextBuffer = [...prevBuffer, tick].slice(-CHART_BUFFER_SIZE);
            return {
                livePrices: { ...state.livePrices, [tick.symbol]: tick },
                chartBuffers: { ...state.chartBuffers, [tick.symbol]: nextBuffer },
            };
        }),

    applySnapshot: (symbol, ticks) =>
        set((state) => ({
            chartBuffers: {
                ...state.chartBuffers,
                [symbol]: ticks.slice(-CHART_BUFFER_SIZE),
            },
        })),

    addAlert: (message) => set((state) => ({ alerts: [message, ...state.alerts].slice(0, 10) })),

    dismissAlert: (index) => set((state) => ({ alerts: state.alerts.filter((_, i) => i !== index) })),

    addNotification: (n) =>
        set((state) => ({
            notifications: [
                { ...n, id: crypto.randomUUID(), ts: Date.now(), read: false },
                ...state.notifications,
            ].slice(0, 50),
        })),

    markAllNotificationsRead: () =>
        set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

    clearNotifications: () => set({ notifications: [] }),

    markAlertTriggered: (alertId) =>
        set((state) => ({
            triggeredAlertIds: state.triggeredAlertIds.includes(alertId)
                ? state.triggeredAlertIds
                : [...state.triggeredAlertIds, alertId],
        })),

    consumeTriggeredAlerts: (alertIds) =>
        set((state) => ({
            triggeredAlertIds: state.triggeredAlertIds.filter((alertId) => !alertIds.includes(alertId)),
        })),
}));
