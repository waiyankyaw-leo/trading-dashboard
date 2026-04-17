import { TICKER_MAP } from "../config/tickers.js";
import type { OHLCVBar } from "../types/index.js";
import { getCached, setCached } from "./cacheService.js";

const VALID_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof VALID_INTERVALS)[number];

const HISTORY_CACHE_TTL_SECONDS = 60;

function intervalToMs(interval: Interval): number {
    const map: Record<Interval, number> = {
        "1m": 60_000,
        "5m": 300_000,
        "15m": 900_000,
        "1h": 3_600_000,
        "4h": 14_400_000,
        "1d": 86_400_000,
    };
    return map[interval];
}

export function getHistory(
    symbol: string,
    interval: string,
    limit: number,
    currentBar?: OHLCVBar,
    historicalBars?: OHLCVBar[],
): OHLCVBar[] | null {
    const upper = symbol.toUpperCase();
    if (!TICKER_MAP.has(upper)) return null;
    if (!isValidInterval(interval)) return null;

    const clampedLimit = Math.min(Math.max(limit, 1), 500);
    const cacheKey = getHistoryCacheKey(upper, interval as Interval, clampedLimit, currentBar, historicalBars);
    const cached = getCached<OHLCVBar[]>(cacheKey);
    if (cached) return cached;

    const hasCurrentBar = !!currentBar;
    const historicalLimit = hasCurrentBar ? Math.max(clampedLimit - 1, 0) : clampedLimit;
    const bars = historicalBars
        ? (historicalLimit > 0 ? historicalBars.slice(-historicalLimit).map((bar) => normalizeBar(bar, upper)) : [])
        : buildBars(upper, interval as Interval, historicalLimit, currentBar?.open);

    if (currentBar && clampedLimit > 0) {
        bars.push(normalizeBar(currentBar, upper));
    }

    setCached(cacheKey, bars, HISTORY_CACHE_TTL_SECONDS);
    return bars;
}

function getHistoryCacheKey(
    symbol: string,
    interval: Interval,
    limit: number,
    currentBar?: OHLCVBar,
    historicalBars?: OHLCVBar[],
): string {
    const liveBarKey = currentBar
        ? [
            currentBar.ts,
            round(currentBar.open, symbol),
            round(currentBar.high, symbol),
            round(currentBar.low, symbol),
            round(currentBar.close, symbol),
            currentBar.volume,
            currentBar.lastUpdateTs ?? "none",
        ].join(":")
        : "none";
    const latestHistoricalBar = historicalBars?.[historicalBars.length - 1];
    const historyKey = historicalBars
        ? [historicalBars.length, latestHistoricalBar?.ts ?? "none", latestHistoricalBar?.close ?? "none"].join(":")
        : "fallback";

    return `history:${symbol}:${interval}:${limit}:${historyKey}:${liveBarKey}`;
}

/**
 * Build CLOSED bars walking backwards from the current live bar open so
 * the last historical close connects seamlessly with the current bar.
 */
function buildBars(symbol: string, interval: Interval, limit: number, endPrice?: number): OHLCVBar[] {
    const ticker = TICKER_MAP.get(symbol)!;
    const intervalMs = intervalToMs(interval);
    const now = Date.now();
    // Snap "now" to current interval boundary so bars align with live tick buckets
    const snappedNow = Math.floor(now / intervalMs) * intervalMs;

    const reverseBars: OHLCVBar[] = [];
    let price = endPrice ?? ticker.basePrice;

    for (let i = 1; i <= limit; i++) {
        // ts = start of this bar
        const ts = snappedNow - i * intervalMs;
        const close = price;

        // Walk intra-bar backwards (4 sub-ticks) to generate open/high/low
        let open = close;
        let high = close;
        let low = close;
        for (let j = 0; j < 4; j++) {
            const z = (Math.random() - 0.5) * 2;
            open = open / (1 + ticker.volatility * 0.1 * z);
            if (open > high) high = open;
            if (open < low) low = open;
        }
        // Ensure OHLC integrity
        high = Math.max(open, close, high);
        low = Math.min(open, close, low);

        reverseBars.push({
            ts,
            open: round(open, symbol),
            high: round(high, symbol),
            low: round(low, symbol),
            close: round(close, symbol),
            volume: Math.floor(Math.random() * 50_000) + 1_000,
        });

        // Walk back: previous bar's close = this bar's open
        price = open;
    }

    // Reverse to get chronological (oldest → newest)
    return reverseBars.reverse();
}

function normalizeBar(bar: OHLCVBar, symbol: string): OHLCVBar {
    return {
        ts: bar.ts,
        open: round(bar.open, symbol),
        high: round(bar.high, symbol),
        low: round(bar.low, symbol),
        close: round(bar.close, symbol),
        volume: bar.volume,
        lastUpdateTs: bar.lastUpdateTs,
    };
}

function round(n: number, symbol: string): number {
    const isCrypto = symbol.includes("BTC") || symbol.includes("ETH");
    return parseFloat(n.toFixed(isCrypto ? 2 : 4));
}

export function isValidInterval(interval: string): interval is Interval {
    return (VALID_INTERVALS as readonly string[]).includes(interval);
}
