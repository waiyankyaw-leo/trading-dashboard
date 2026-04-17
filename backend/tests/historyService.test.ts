import { beforeEach, describe, it, expect } from "vitest";
import { getHistory, isValidInterval } from "../src/services/historyService.js";
import { clearCache } from "../src/services/cacheService.js";

describe("historyService", () => {
    beforeEach(() => {
        clearCache();
    });

    describe("isValidInterval", () => {
        it("should accept valid intervals", () => {
            expect(isValidInterval("1m")).toBe(true);
            expect(isValidInterval("5m")).toBe(true);
            expect(isValidInterval("15m")).toBe(true);
            expect(isValidInterval("1h")).toBe(true);
            expect(isValidInterval("1d")).toBe(true);
        });

        it("should reject invalid intervals", () => {
            expect(isValidInterval("2m")).toBe(false);
            expect(isValidInterval("")).toBe(false);
            expect(isValidInterval("invalid")).toBe(false);
        });
    });

    describe("getHistory", () => {
        it("should return OHLCV bars for valid symbol and interval", () => {
            const bars = getHistory("AAPL", "1m", 10);
            expect(bars).not.toBeNull();
            expect(bars).toHaveLength(10);
        });

        it("should return null for unknown symbol", () => {
            expect(getHistory("UNKNOWN", "1m", 10)).toBeNull();
        });

        it("should return null for invalid interval", () => {
            expect(getHistory("AAPL", "2m", 10)).toBeNull();
        });

        it("should clamp limit to max 500", () => {
            const bars = getHistory("AAPL", "1m", 9999);
            expect(bars).not.toBeNull();
            expect(bars!.length).toBeLessThanOrEqual(500);
        });

        it("should append the provided current bar within the requested limit", () => {
            const currentBar = {
                ts: Date.now(),
                open: 185,
                high: 186.5,
                low: 184.25,
                close: 185.75,
                volume: 42_000,
                lastUpdateTs: Date.now() + 250,
            };

            const bars = getHistory("AAPL", "1m", 10, currentBar);
            expect(bars).not.toBeNull();
            expect(bars).toHaveLength(10);
            expect(bars?.at(-1)).toMatchObject(currentBar);
        });

        it("each bar should have OHLCV fields", () => {
            const bars = getHistory("TSLA", "5m", 5)!;
            for (const bar of bars) {
                expect(bar).toHaveProperty("ts");
                expect(bar).toHaveProperty("open");
                expect(bar).toHaveProperty("high");
                expect(bar).toHaveProperty("low");
                expect(bar).toHaveProperty("close");
                expect(bar).toHaveProperty("volume");
                expect(bar.high).toBeGreaterThanOrEqual(bar.low);
                expect(bar.volume).toBeGreaterThan(0);
            }
        });

        it("bars should be in chronological order", () => {
            const bars = getHistory("GOOGL", "1m", 20)!;
            for (let i = 1; i < bars.length; i++) {
                expect(bars[i].ts).toBeGreaterThan(bars[i - 1].ts);
            }
        });

        it("should be case-insensitive for symbol", () => {
            const bars = getHistory("aapl", "1m", 5);
            expect(bars).not.toBeNull();
        });

        it("should return cached data on second call", () => {
            const bars1 = getHistory("MSFT", "15m", 10);
            const bars2 = getHistory("MSFT", "15m", 10);
            expect(bars1).toBe(bars2);
        });

        it("crypto prices should have 2 decimal places", () => {
            const bars = getHistory("BTC-USD", "1m", 5)!;
            for (const bar of bars) {
                const decimals = bar.close.toString().split(".")[1]?.length ?? 0;
                expect(decimals).toBeLessThanOrEqual(2);
            }
        });
    });
});
