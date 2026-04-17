import { describe, it, expect, beforeEach } from "vitest";
import { MarketSimulator } from "../src/services/marketSimulator.js";

describe("MarketSimulator", () => {
    let sim: MarketSimulator;

    beforeEach(() => {
        sim = new MarketSimulator();
    });

    it("should initialize prices for all tickers", () => {
        expect(sim.getLastPrice("AAPL")).toBe(185.0);
        expect(sim.getLastPrice("TSLA")).toBe(220.0);
        expect(sim.getLastPrice("BTC-USD")).toBe(62000.0);
        expect(sim.getLastPrice("ETH-USD")).toBe(3100.0);
        expect(sim.getLastPrice("GOOGL")).toBe(175.0);
        expect(sim.getLastPrice("MSFT")).toBe(415.0);
    });

    it("should return undefined for unknown symbols", () => {
        expect(sim.getLastPrice("UNKNOWN")).toBeUndefined();
    });

    it("should have empty buffers initially", () => {
        expect(sim.getBuffer("AAPL")).toHaveLength(0);
        expect(sim.getBuffer("UNKNOWN")).toHaveLength(0);
    });

    it("should expose seeded historical bars in chronological order", () => {
        const bars = sim.getHistoricalBars("AAPL", "1m", 10);
        expect(bars).toHaveLength(10);
        for (let i = 1; i < bars.length; i++) {
            expect(bars[i].ts).toBeGreaterThan(bars[i - 1].ts);
        }
    });

    it("seeded history should include visible bodies and wicks", () => {
        const bars = sim.getHistoricalBars("TSLA", "1m", 30);
        const bodyBars = bars.filter((bar) => Math.abs(bar.close - bar.open) >= 0.08);
        const wickBars = bars.filter(
            (bar) => bar.high > Math.max(bar.open, bar.close) && bar.low < Math.min(bar.open, bar.close),
        );

        expect(bodyBars.length).toBeGreaterThan(10);
        expect(wickBars.length).toBeGreaterThan(10);
    });

    it("nextPrice should produce a valid positive number", () => {
        const price = sim.nextPrice("AAPL");
        expect(price).toBeGreaterThan(0);
        expect(typeof price).toBe("number");
        expect(Number.isFinite(price)).toBe(true);
    });

    it("nextPrice should throw for unknown symbols", () => {
        expect(() => sim.nextPrice("INVALID")).toThrow("Unknown symbol");
    });

    it("nextPrice should stay within reasonable bounds after 100 iterations", () => {
        let price = 185.0;
        for (let i = 0; i < 100; i++) {
            price = sim.nextPrice("AAPL");
        }
        // After 100 ticks with low volatility, price should stay within 50%-200% of base
        expect(price).toBeGreaterThan(92.5);
        expect(price).toBeLessThan(370.0);
    });

    it("gaussianRandom should produce values mostly within [-4, 4]", () => {
        const values: number[] = [];
        for (let i = 0; i < 1000; i++) {
            values.push(sim.gaussianRandom());
        }
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        // Mean should be roughly 0
        expect(Math.abs(mean)).toBeLessThan(0.2);
        // All values should be finite
        expect(values.every(Number.isFinite)).toBe(true);
    });

    it("should emit tick events when start is called", async () => {
        const ticks: unknown[] = [];
        sim.on("tick", (tick) => ticks.push(tick));

        sim.start();
        await new Promise((r) => setTimeout(r, 1200));
        sim.stop();

        expect(ticks.length).toBeGreaterThanOrEqual(6); // 6 tickers per interval
    });

    it("should not start twice", () => {
        sim.start();
        sim.start(); // second call should be no-op
        sim.stop();
    });

    it("tick should have correct shape", async () => {
        const ticks: unknown[] = [];
        sim.on("tick", (tick) => ticks.push(tick));

        sim.start();
        await new Promise((r) => setTimeout(r, 1200));
        sim.stop();

        const tick = ticks[0] as Record<string, unknown>;
        expect(tick).toHaveProperty("symbol");
        expect(tick).toHaveProperty("price");
        expect(tick).toHaveProperty("change");
        expect(tick).toHaveProperty("changePercent");
        expect(tick).toHaveProperty("volume");
        expect(tick).toHaveProperty("ts");
        expect(typeof tick.price).toBe("number");
        expect(typeof tick.ts).toBe("number");
    });
});
