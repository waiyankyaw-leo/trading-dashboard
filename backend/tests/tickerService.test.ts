import { describe, it, expect } from "vitest";
import { listTickers, getTicker, isValidSymbol } from "../src/services/tickerService.js";

describe("tickerService", () => {
    describe("listTickers", () => {
        it("should return all 6 tickers", () => {
            const tickers = listTickers();
            expect(tickers).toHaveLength(6);
        });

        it("each ticker should have symbol, name, and price", () => {
            const tickers = listTickers();
            for (const t of tickers) {
                expect(t).toHaveProperty("symbol");
                expect(t).toHaveProperty("name");
                expect(t).toHaveProperty("price");
                expect(typeof t.symbol).toBe("string");
                expect(typeof t.name).toBe("string");
                expect(typeof t.price).toBe("number");
                expect(t.price).toBeGreaterThan(0);
            }
        });

        it("should include AAPL, TSLA, BTC-USD", () => {
            const symbols = listTickers().map((t) => t.symbol);
            expect(symbols).toContain("AAPL");
            expect(symbols).toContain("TSLA");
            expect(symbols).toContain("BTC-USD");
        });
    });

    describe("getTicker", () => {
        it("should return ticker details for valid symbol", () => {
            const ticker = getTicker("AAPL");
            expect(ticker).not.toBeNull();
            expect(ticker!.symbol).toBe("AAPL");
            expect(ticker!.name).toBe("Apple Inc.");
            expect(ticker!.price).toBeGreaterThan(0);
        });

        it("should be case-insensitive", () => {
            const ticker = getTicker("aapl");
            expect(ticker).not.toBeNull();
            expect(ticker!.symbol).toBe("AAPL");
        });

        it("should return null for unknown symbol", () => {
            expect(getTicker("UNKNOWN")).toBeNull();
            expect(getTicker("")).toBeNull();
        });
    });

    describe("isValidSymbol", () => {
        it("should return true for valid symbols", () => {
            expect(isValidSymbol("AAPL")).toBe(true);
            expect(isValidSymbol("btc-usd")).toBe(true);
            expect(isValidSymbol("MSFT")).toBe(true);
        });

        it("should return false for invalid symbols", () => {
            expect(isValidSymbol("INVALID")).toBe(false);
            expect(isValidSymbol("")).toBe(false);
        });
    });
});
