import { useEffect, useRef, useCallback } from "react";
import { useTickerStore } from "../store/tickerStore";
import { authClient } from "@/lib/authClient";
import type { WsMessage } from "../types";

const RECONNECT_DELAY_MS = 3000;

export function useWebSocket(symbols: string[]) {
    const wsRef = useRef<WebSocket | null>(null);
    const symbolsRef = useRef(symbols);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seenAlertIdsRef = useRef<Set<string>>(new Set());
    const sessionTokenRef = useRef<string | null>(null);
    const applyTick = useTickerStore((s) => s.applyTick);
    const applySnapshot = useTickerStore((s) => s.applySnapshot);
    const addAlert = useTickerStore((s) => s.addAlert);
    const addNotification = useTickerStore((s) => s.addNotification);
    const markAlertTriggered = useTickerStore((s) => s.markAlertTriggered);

    symbolsRef.current = symbols;

    // Fetch and cache the session token so it can be passed to the WS URL
    // (the WS connects cross-origin to Railway; cookies aren't sent there).
    useEffect(() => {
        authClient.getSession()
            .then((res) => {
                sessionTokenRef.current = (res as { data?: { session?: { token?: string } } })?.data?.session?.token ?? null;
            })
            .catch(() => { /* unauthenticated */ });
    }, []);

    const getWsUrl = useCallback(() => {
        const loc = window.location;
        const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
        const wsBase = import.meta.env.VITE_WS_URL;
        let base = wsBase ? `${wsBase}/ws` : `${protocol}//${loc.host}/ws`;
        if (sessionTokenRef.current) {
            base += `?token=${encodeURIComponent(sessionTokenRef.current)}`;
        }
        return base;
    }, []);

    const subscribe = useCallback((ws: WebSocket) => {
        if (ws.readyState === WebSocket.OPEN && symbolsRef.current.length > 0) {
            ws.send(JSON.stringify({ type: "SUBSCRIBE", symbols: symbolsRef.current }));
        }
    }, []);

    const connect = useCallback(() => {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onopen = () => subscribe(ws);

        ws.onmessage = (event) => {
            try {
                const msg: WsMessage = JSON.parse(event.data);

                switch (msg.type) {
                    case "TICK":
                        if (msg.symbol && msg.price !== undefined) {
                            applyTick({
                                symbol: msg.symbol,
                                price: msg.price,
                                change: msg.change ?? 0,
                                changePercent: msg.changePercent ?? 0,
                                volume: msg.volume ?? 0,
                                ts: msg.ts ?? Date.now(),
                            });
                        }
                        break;

                    case "SNAPSHOT":
                        if (msg.symbol && msg.ticks) {
                            applySnapshot(msg.symbol, msg.ticks);
                        }
                        break;

                    case "ALERT":
                        if (msg.alertId && seenAlertIdsRef.current.has(msg.alertId)) {
                            break;
                        }
                        if (msg.alertId) seenAlertIdsRef.current.add(msg.alertId);
                        if (msg.message) {
                            addAlert(msg.message);
                            addNotification({
                                message: msg.message,
                                symbol: msg.symbol,
                                price: msg.price,
                            });
                        }
                        if (msg.alertId) markAlertTriggered(msg.alertId);
                        break;
                }
            } catch {
                // Malformed message — ignore
            }
        };

        ws.onclose = () => {
            reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        };

        ws.onerror = () => ws.close();
    }, [getWsUrl, subscribe, applyTick, applySnapshot, addAlert, addNotification, markAlertTriggered]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
        };
    }, [connect]);

    // Re-subscribe when symbols change
    useEffect(() => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            subscribe(ws);
        }
    }, [symbols, subscribe]);

    const setAlert = useCallback((alertId: string, symbol: string, above?: number, below?: number) => {
        wsRef.current?.send(JSON.stringify({ type: "SET_ALERT", alertId, symbol, above, below }));
    }, []);

    const removeAlert = useCallback((alertId: string) => {
        wsRef.current?.send(JSON.stringify({ type: "REMOVE_ALERT", alertId }));
    }, []);

    return { setAlert, removeAlert };
}
