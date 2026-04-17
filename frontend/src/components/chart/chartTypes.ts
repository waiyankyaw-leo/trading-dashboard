import type { UTCTimestamp } from "lightweight-charts";

export interface CandleData {
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
}

export interface Legend {
    time: string;
    open: string;
    high: string;
    low: string;
    close: string;
    isUp: boolean;
}
