import { apiClient } from "./axiosClient";
import type { TickerSummary, OHLCVBar } from "../types";

export const fetchTickers = () =>
    apiClient.get<TickerSummary[]>("/api/tickers").then((r) => r.data);

export const fetchTicker = (symbol: string) =>
    apiClient.get<TickerSummary>(`/api/tickers/${symbol}`).then((r) => r.data);

export const fetchHistory = (symbol: string, interval = "1m", limit = 60) =>
    apiClient
        .get<OHLCVBar[]>(`/api/tickers/${symbol}/history`, {
            params: { interval, limit },
        })
        .then((r) => r.data);
