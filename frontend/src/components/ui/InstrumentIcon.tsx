import { clsx } from "clsx";
import { useState } from "react";

const INSTRUMENT_ICON_MAP: Record<string, { src: string; fallback: string; fallbackBg: string }> = {
    AAPL: {
        src: "https://www.google.com/s2/favicons?domain=apple.com&sz=128",
        fallback: "A",
        fallbackBg: "#111827",
    },
    TSLA: {
        src: "https://www.google.com/s2/favicons?domain=tesla.com&sz=128",
        fallback: "T",
        fallbackBg: "#b91c1c",
    },
    "BTC-USD": {
        src: "https://www.google.com/s2/favicons?domain=bitcoin.org&sz=128",
        fallback: "₿",
        fallbackBg: "#f59e0b",
    },
    "ETH-USD": {
        src: "https://www.google.com/s2/favicons?domain=ethereum.org&sz=128",
        fallback: "Ξ",
        fallbackBg: "#6366f1",
    },
    GOOGL: {
        src: "https://www.google.com/s2/favicons?domain=google.com&sz=128",
        fallback: "G",
        fallbackBg: "#2563eb",
    },
    MSFT: {
        src: "https://www.google.com/s2/favicons?domain=microsoft.com&sz=128",
        fallback: "M",
        fallbackBg: "#0ea5e9",
    },
};

type InstrumentIconSize = "sm" | "md" | "lg";

interface InstrumentIconProps {
    symbol: string;
    size?: InstrumentIconSize;
    className?: string;
}

const SIZE_CLASS_MAP: Record<InstrumentIconSize, string> = {
    sm: "h-9 w-9 rounded-xl",
    md: "h-11 w-11 rounded-2xl",
    lg: "h-14 w-14 rounded-2xl",
};

export function InstrumentIcon({ symbol, size = "md", className }: InstrumentIconProps) {
    const [hasError, setHasError] = useState(false);
    const icon = INSTRUMENT_ICON_MAP[symbol] ?? {
        src: "",
        fallback: symbol[0] ?? "?",
        fallbackBg: "#334155",
    };

    return (
        <div
            className={clsx(
                "relative shrink-0 overflow-hidden border border-slate-700/70 bg-slate-900/90 shadow-[0_8px_20px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]",
                SIZE_CLASS_MAP[size],
                className,
            )}
            style={hasError ? { background: icon.fallbackBg } : undefined}
        >
            {!hasError && icon.src ? (
                <img
                    src={icon.src}
                    alt={`${symbol} icon`}
                    className="h-full w-full object-contain bg-slate-900 p-1.5"
                    referrerPolicy="no-referrer"
                    draggable={false}
                    onError={() => setHasError(true)}
                />
            ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                    {icon.fallback}
                </span>
            )}
        </div>
    );
}