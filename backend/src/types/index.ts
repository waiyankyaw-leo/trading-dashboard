export interface Ticker {
    symbol: string;
    name: string;
    basePrice: number;
    volatility: number;
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

export interface WsIncomingMessage {
    type: "SUBSCRIBE" | "UNSUBSCRIBE" | "SET_ALERT" | "REMOVE_ALERT";
    symbols?: string[];
    symbol?: string;
    alertId?: string;
    above?: number;
    below?: number;
}

export interface WsOutgoingMessage {
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

declare module "fastify" {
    interface FastifyRequest {
        session?: {
            user: { id: string; email: string; name: string };
            session: { id: string; expiresAt: Date };
        };
    }
}
