import { useQuery } from "@tanstack/react-query";
import { fetchTickers, fetchHistory } from "../api/tickersApi";

export function useTickers() {
    return useQuery({
        queryKey: ["tickers"],
        queryFn: fetchTickers,
        staleTime: 30_000,
    });
}

export function useHistory(symbol: string, interval = "1m", limit = 60) {
    return useQuery({
        queryKey: ["history", symbol, interval, limit],
        queryFn: () => fetchHistory(symbol, interval, limit),
        staleTime: 60_000,
        enabled: !!symbol,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
}
