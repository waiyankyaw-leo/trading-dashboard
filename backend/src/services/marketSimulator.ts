import { EventEmitter } from "events";
import { TICKERS } from "../config/tickers.js";
import type { OHLCVBar, Tick } from "../types/index.js";

const BUFFER_SIZE = 500;
const SEEDED_HISTORY_BARS = 500;
const MAX_HISTORICAL_BARS = 600;
const TICK_INTERVAL_MS = parseInt(process.env.TICK_INTERVAL_MS ?? "1000", 10);
const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];

const INTERVAL_MS: Record<Interval, number> = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
};

const HISTORY_BODY_SCALE: Record<Interval, number> = {
    "1m": 0.26,
    "5m": 0.32,
    "15m": 0.4,
    "1h": 0.52,
    "4h": 0.68,
    "1d": 0.9,
};

function roundPrice(symbol: string, value: number): number {
    const isCrypto = symbol.includes("BTC") || symbol.includes("ETH");
    return parseFloat(value.toFixed(isCrypto ? 2 : 4));
}

function seededUnit(seed: string): number {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967296;
}

function seededSigned(seed: string): number {
    return seededUnit(seed) * 2 - 1;
}

function cloneBar(bar: OHLCVBar): OHLCVBar {
    return { ...bar };
}

function buildSeededHistory(
    symbol: string,
    volatility: number,
    basePrice: number,
    interval: Interval,
    limit: number,
    now: number,
): OHLCVBar[] {
    const intervalMs = INTERVAL_MS[interval];
    const snappedNow = Math.floor(now / intervalMs) * intervalMs;
    const bars: OHLCVBar[] = [];

    const bodyScale = HISTORY_BODY_SCALE[interval];
    const baseVol = volatility * bodyScale;
    let prevClose = basePrice;
    // Lower persistence (0.68) so momentum dies in ~2 bars, preventing multi-dozen-candle trends
    let momentum = 0;
    let volState = Math.max(baseVol, volatility * 0.08);

    for (let i = 0; i < limit; i++) {
        const ts = snappedNow - (limit - i) * intervalMs;
        // Shorter regimes (every 7 bars) with weaker bias → runs of 3-8 candles, not 20+
        const regimeSeed = Math.floor(ts / (intervalMs * 7));
        const regimeBias = seededSigned(`${symbol}:${interval}:${regimeSeed}:regime`) * baseVol * 0.22;
        const shock = seededSigned(`${symbol}:${interval}:${ts}:shock`) * volState * 0.75;
        const idiosyncratic = seededSigned(`${symbol}:${interval}:${ts}:idio`) * baseVol * 0.4;

        // Mean reversion toward basePrice prevents unlimited drift
        const priceDev = (prevClose - basePrice) / basePrice;
        const reversionForce = -priceDev * 0.03;

        momentum = momentum * 0.68 + regimeBias * 0.18 + shock * 0.32 + idiosyncratic * 0.28 + reversionForce;

        const volShock = Math.abs(seededSigned(`${symbol}:${interval}:${ts}:vol`));
        volState = Math.min(
            Math.max(volState * 0.72 + volShock * baseVol * 0.85, baseVol * 0.55),
            baseVol * 2.4,
        );

        const gapPct = seededSigned(`${symbol}:${interval}:${ts}:gap`) * volState * 0.12;
        const open = Math.max(prevClose * (1 + gapPct), basePrice * 0.08);

        // Range-first approach: generate the full bar range, then split into body + wicks
        // This ensures bodies are always a significant fraction of the bar height
        const totalRange = Math.max(volState * 4.0, baseVol * 1.8);

        // Body fraction of total range: 30-95%, skewed toward 50-80% for realistic look
        const bodyFracSeed = seededUnit(`${symbol}:${interval}:${ts}:body-frac`);
        const bodyFrac = 0.30 + bodyFracSeed * bodyFracSeed * 0.65; // quadratic: more large-body candles

        const bodySize = totalRange * bodyFrac;
        const bodyDirection = momentum >= 0 ? 1 : -1;
        const close = Math.max(open * (1 + bodyDirection * bodySize), basePrice * 0.08);

        // Split remaining range (wicks) between upper and lower
        const remainingRange = totalRange * (1 - bodyFrac);
        const wickSplit = seededUnit(`${symbol}:${interval}:${ts}:wick-split`);
        const upperWickPct = remainingRange * wickSplit;
        const lowerWickPct = remainingRange * (1 - wickSplit);

        const bodyHigh = Math.max(open, close);
        const bodyLow = Math.min(open, close);
        const high = bodyHigh * (1 + upperWickPct);
        const low = Math.max(bodyLow * (1 - lowerWickPct), 0.01);

        const volumeNoise = seededUnit(`${symbol}:${interval}:${ts}:volume`);
        const volume = Math.floor((3_000 + volumeNoise * 28_000) * (1 + bodyFrac * 4.5 + volState * 22));

        bars.push({
            ts,
            open: roundPrice(symbol, open),
            high: roundPrice(symbol, Math.max(bodyHigh, high)),
            low: roundPrice(symbol, Math.min(bodyLow, low)),
            close: roundPrice(symbol, close),
            volume,
        });

        prevClose = close;
    }

    const lastClose = bars[bars.length - 1]?.close;
    if (!lastClose || !Number.isFinite(lastClose) || lastClose <= 0) {
        return bars;
    }

    const scale = basePrice / lastClose;
    return bars.map((bar) => ({
        ts: bar.ts,
        open: roundPrice(symbol, bar.open * scale),
        high: roundPrice(symbol, bar.high * scale),
        low: roundPrice(symbol, bar.low * scale),
        close: roundPrice(symbol, bar.close * scale),
        volume: bar.volume,
    }));
}

export class MarketSimulator extends EventEmitter {
    private prices = new Map<string, number>();
    private buffers = new Map<string, Tick[]>();
    private currentBars = new Map<string, Map<Interval, OHLCVBar>>();
    private historicalBars = new Map<string, Map<Interval, OHLCVBar[]>>();
    private openPrices = new Map<string, number>();
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        super();
        const seedNow = Date.now();
        for (const t of TICKERS) {
            this.prices.set(t.symbol, t.basePrice);
            this.openPrices.set(t.symbol, t.basePrice);
            this.buffers.set(t.symbol, []);
            this.currentBars.set(t.symbol, new Map());
            this.historicalBars.set(t.symbol, this.seedHistoricalBars(t.symbol, t.basePrice, t.volatility, seedNow));
        }
    }

    private seedHistoricalBars(symbol: string, basePrice: number, volatility: number, now: number): Map<Interval, OHLCVBar[]> {
        const historyByInterval = new Map<Interval, OHLCVBar[]>();
        for (const interval of INTERVALS) {
            historyByInterval.set(
                interval,
                buildSeededHistory(symbol, volatility, basePrice, interval, SEEDED_HISTORY_BARS, now),
            );
        }
        return historyByInterval;
    }

    start(): void {
        if (this.timer) return;
        this.timer = setInterval(() => this.generateTicks(), TICK_INTERVAL_MS);
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    getBuffer(symbol: string): Tick[] {
        return this.buffers.get(symbol) ?? [];
    }

    getHistoricalBars(symbol: string, interval: string, limit: number): OHLCVBar[] {
        const clampedLimit = Math.max(limit, 0);
        const bars = this.historicalBars.get(symbol)?.get(interval as Interval) ?? [];
        return bars.slice(-clampedLimit).map(cloneBar);
    }

    getLastPrice(symbol: string): number | undefined {
        return this.prices.get(symbol);
    }

    getCurrentBar(symbol: string, interval: string): OHLCVBar | undefined {
        const bar = this.currentBars.get(symbol)?.get(interval as Interval);
        return bar ? { ...bar } : undefined;
    }

    /**
     * Geometric Brownian Motion:
     *   S(t+dt) = S(t) * exp((μ - σ²/2)*dt + σ * √dt * Z)
     *   where Z ~ N(0,1) via Box-Muller transform
     */
    nextPrice(symbol: string): number {
        const ticker = TICKERS.find((t) => t.symbol === symbol);
        if (!ticker) throw new Error(`Unknown symbol: ${symbol}`);
        const prev = this.prices.get(symbol)!;
        const dt = TICK_INTERVAL_MS / 1000;
        const drift = 0.000001;
        // Match history seed scale: history 1m bars use totalRange ≈ volatility * 1.04
        // GBM range over 60 ticks ≈ sigma * sqrt(60) * 2.5 → sigma = volatility * 1.04 / (7.746 * 2.5) ≈ volatility * 0.054
        const sigma = ticker.volatility * 0.054;
        const z = this.gaussianRandom();
        const next = prev * Math.exp((drift - sigma ** 2 / 2) * dt + sigma * Math.sqrt(dt) * z);
        const isCrypto = symbol.includes("BTC") || symbol.includes("ETH");
        return parseFloat(next.toFixed(isCrypto ? 2 : 4));
    }

    /** Box-Muller transform: generates standard normal random variable */
    gaussianRandom(): number {
        let u = 0;
        let v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    private appendHistoricalBar(symbol: string, interval: Interval, bar: OHLCVBar): void {
        const historyByInterval = this.historicalBars.get(symbol) ?? new Map<Interval, OHLCVBar[]>();
        const bars = historyByInterval.get(interval) ?? [];
        const nextBar = cloneBar(bar);
        const lastBar = bars[bars.length - 1];

        if (lastBar?.ts === nextBar.ts) {
            bars[bars.length - 1] = nextBar;
        } else {
            bars.push(nextBar);
            if (bars.length > MAX_HISTORICAL_BARS) {
                bars.splice(0, bars.length - MAX_HISTORICAL_BARS);
            }
        }

        historyByInterval.set(interval, bars);
        this.historicalBars.set(symbol, historyByInterval);
    }

    private updateCurrentBars(tick: Tick): void {
        const symbolBars = this.currentBars.get(tick.symbol) ?? new Map<Interval, OHLCVBar>();

        for (const interval of INTERVALS) {
            const bucketStart = Math.floor(tick.ts / INTERVAL_MS[interval]) * INTERVAL_MS[interval];
            const existing = symbolBars.get(interval);

            if (!existing || existing.ts !== bucketStart) {
                if (existing && existing.ts !== bucketStart) {
                    this.appendHistoricalBar(tick.symbol, interval, existing);
                }
                symbolBars.set(interval, {
                    ts: bucketStart,
                    open: roundPrice(tick.symbol, tick.price),
                    high: roundPrice(tick.symbol, tick.price),
                    low: roundPrice(tick.symbol, tick.price),
                    close: roundPrice(tick.symbol, tick.price),
                    volume: tick.volume,
                    lastUpdateTs: tick.ts,
                });
                continue;
            }

            existing.high = roundPrice(tick.symbol, Math.max(existing.high, tick.price));
            existing.low = roundPrice(tick.symbol, Math.min(existing.low, tick.price));
            existing.close = roundPrice(tick.symbol, tick.price);
            existing.volume += tick.volume;
            existing.lastUpdateTs = tick.ts;
        }

        this.currentBars.set(tick.symbol, symbolBars);
    }

    private generateTicks(): void {
        for (const t of TICKERS) {
            const newPrice = this.nextPrice(t.symbol);
            const openPrice = this.openPrices.get(t.symbol)!;
            const change = parseFloat((newPrice - openPrice).toFixed(4));
            const changePercent = parseFloat(((change / openPrice) * 100).toFixed(4));
            const volume = Math.floor(Math.random() * 10000) + 100;

            const tick: Tick = {
                symbol: t.symbol,
                price: newPrice,
                change,
                changePercent,
                volume,
                ts: Date.now(),
            };

            this.prices.set(t.symbol, newPrice);

            const buffer = this.buffers.get(t.symbol)!;
            buffer.push(tick);
            if (buffer.length > BUFFER_SIZE) buffer.shift();

            this.updateCurrentBars(tick);

            this.emit("tick", tick);
            this.emit(`tick:${t.symbol}`, tick);
        }
    }
}

// Singleton instance
export const simulator = new MarketSimulator();
