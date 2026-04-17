import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTickerStore } from "../store/tickerStore";
import type { Tick } from "../types";

const makeTick = (overrides: Partial<Tick> = {}): Tick => ({
    symbol: "AAPL",
    price: 185.5,
    change: 0.5,
    changePercent: 0.27,
    volume: 5000,
    ts: Date.now(),
    ...overrides,
});

describe("tickerStore", () => {
    it("should set tickers", () => {
        const { result } = renderHook(() => useTickerStore());

        act(() => {
            result.current.setTickers([
                { symbol: "AAPL", name: "Apple", price: 185 },
                { symbol: "TSLA", name: "Tesla", price: 220 },
            ]);
        });

        expect(result.current.tickers).toHaveLength(2);
        expect(result.current.tickers[0].symbol).toBe("AAPL");
    });

    it("should select a symbol", () => {
        const { result } = renderHook(() => useTickerStore());

        act(() => {
            result.current.setSelectedSymbol("BTC-USD");
        });

        expect(result.current.selectedSymbol).toBe("BTC-USD");
    });

    it("should apply a tick and update live price", () => {
        const { result } = renderHook(() => useTickerStore());

        const tick = makeTick({ symbol: "AAPL", price: 190.0 });
        act(() => {
            result.current.applyTick(tick);
        });

        expect(result.current.livePrices["AAPL"]).toBeDefined();
        expect(result.current.livePrices["AAPL"].price).toBe(190.0);
    });

    it("should maintain chart buffer with max size", () => {
        const { result } = renderHook(() => useTickerStore());

        act(() => {
            for (let i = 0; i < 150; i++) {
                result.current.applyTick(makeTick({ price: 180 + i, ts: Date.now() + i }));
            }
        });

        expect(result.current.chartBuffers["AAPL"].length).toBeLessThanOrEqual(120);
    });

    it("should apply a snapshot", () => {
        const { result } = renderHook(() => useTickerStore());

        const ticks = Array.from({ length: 10 }, (_, i) =>
            makeTick({ price: 180 + i, ts: Date.now() + i }),
        );

        act(() => {
            result.current.applySnapshot("TSLA", ticks);
        });

        expect(result.current.chartBuffers["TSLA"]).toHaveLength(10);
    });

    it("should add and dismiss alerts", () => {
        const { result } = renderHook(() => useTickerStore());

        act(() => {
            result.current.addAlert("AAPL crossed 200");
            result.current.addAlert("TSLA dropped below 200");
        });

        expect(result.current.alerts).toHaveLength(2);
        expect(result.current.alerts[0]).toBe("TSLA dropped below 200"); // newest first

        act(() => {
            result.current.dismissAlert(0);
        });

        expect(result.current.alerts).toHaveLength(1);
        expect(result.current.alerts[0]).toBe("AAPL crossed 200");
    });

    it("should cap alerts at 10", () => {
        const { result } = renderHook(() => useTickerStore());

        act(() => {
            for (let i = 0; i < 15; i++) {
                result.current.addAlert(`Alert ${i}`);
            }
        });

        expect(result.current.alerts).toHaveLength(10);
    });
});
