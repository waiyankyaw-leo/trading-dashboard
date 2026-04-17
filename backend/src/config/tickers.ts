import type { Ticker } from "../types/index.js";

export const TICKERS: Ticker[] = [
    { symbol: "AAPL", name: "Apple Inc.", basePrice: 185.0, volatility: 0.015 },
    { symbol: "TSLA", name: "Tesla Inc.", basePrice: 220.0, volatility: 0.035 },
    { symbol: "BTC-USD", name: "Bitcoin", basePrice: 62000.0, volatility: 0.03 },
    { symbol: "ETH-USD", name: "Ethereum", basePrice: 3100.0, volatility: 0.04 },
    { symbol: "GOOGL", name: "Alphabet Inc.", basePrice: 175.0, volatility: 0.018 },
    { symbol: "MSFT", name: "Microsoft Corp.", basePrice: 415.0, volatility: 0.014 },
];

export const TICKER_MAP = new Map(TICKERS.map((t) => [t.symbol, t]));
