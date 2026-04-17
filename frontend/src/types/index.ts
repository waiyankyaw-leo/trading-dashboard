export interface TickerSummary {
    symbol: string;
    name: string;
    price: number;
}

export interface Tick {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    ts: number;
}

export interface OHLCVBar {
    ts: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    lastUpdateTs?: number;
}

export interface PriceAlert {
    id: string;
    symbol: string;
    above: number | null;
    below: number | null;
    createdAt: string;
    triggeredAt: string | null;
}

export interface WsMessage {
    type: "TICK" | "SNAPSHOT" | "ALERT" | "ERROR" | "SUBSCRIBED";
    symbol?: string;
    price?: number;
    change?: number;
    changePercent?: number;
    volume?: number;
    ts?: number;
    ticks?: Tick[];
    message?: string;
    code?: string;
    alertId?: string;
}
