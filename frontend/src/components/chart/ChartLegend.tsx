import type { Legend } from "./chartTypes";

interface ChartLegendProps {
    legend: Legend | null;
}

export function ChartLegend({ legend }: ChartLegendProps) {
    if (!legend) return null;
    return (
        <div className="absolute top-2 right-20 z-10 flex items-center gap-2 pointer-events-none select-none">
            <div className="flex items-center gap-2 text-[11px] font-mono bg-gray-900/70 backdrop-blur-sm rounded px-2 py-1">
                <span className="text-gray-500">O</span>
                <span className="text-gray-200">{legend.open}</span>
                <span className="text-gray-500">H</span>
                <span className="text-green-400">{legend.high}</span>
                <span className="text-gray-500">L</span>
                <span className="text-red-400">{legend.low}</span>
                <span className="text-gray-500">C</span>
                <span className={legend.isUp ? "text-green-400" : "text-red-400"}>{legend.close}</span>
            </div>
        </div>
    );
}
