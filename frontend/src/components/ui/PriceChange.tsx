import { clsx } from "clsx";

interface PriceChangeProps {
    value: number;
    percent: number;
    size?: "sm" | "md" | "lg";
}

export function PriceChange({ value, percent, size = "sm" }: PriceChangeProps) {
    const isPositive = value >= 0;

    const textSizes = {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
    };

    return (
        <span className={clsx(textSizes[size], "font-medium", isPositive ? "text-gain" : "text-loss")}>
            {isPositive ? "+" : ""}
            {value.toFixed(2)} ({isPositive ? "+" : ""}
            {percent.toFixed(2)}%)
        </span>
    );
}
