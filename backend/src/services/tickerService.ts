import { TICKERS, TICKER_MAP } from "../config/tickers.js";
import { simulator } from "./marketSimulator.js";

export function listTickers() {
    return TICKERS.map((t) => ({
        symbol: t.symbol,
        name: t.name,
        price: simulator.getLastPrice(t.symbol) ?? t.basePrice,
    }));
}

export function getTicker(symbol: string) {
    const upper = symbol.toUpperCase();
    const ticker = TICKER_MAP.get(upper);
    if (!ticker) return null;
    return {
        symbol: ticker.symbol,
        name: ticker.name,
        basePrice: ticker.basePrice,
        volatility: ticker.volatility,
        price: simulator.getLastPrice(ticker.symbol) ?? ticker.basePrice,
    };
}

export function isValidSymbol(symbol: string): boolean {
    return TICKER_MAP.has(symbol.toUpperCase());
}
